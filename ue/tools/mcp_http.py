# MCP HTTP helper: dumps big responses to disk, zero context cost.
# usage: python mcp.py describe <toolset>            -> prints tool names + required params, saves json
#        python mcp.py call <toolset> <tool> '<json>' [outfile]  -> prints result (truncated) or saves
import sys, json, subprocess, os, re
URL="http://127.0.0.1:8001/mcp"
HERE=os.path.dirname(os.path.abspath(__file__))
def post(body, sid=None, dump_headers=None):
    # -N: no buffering; we stop reading as soon as the first SSE data line arrives,
    # otherwise the server keeps the stream open ~16s per call.
    cmd=["curl","-s","-N","-X","POST",URL,"-H","Content-Type: application/json","-H","Accept: application/json, text/event-stream","-d",json.dumps(body)]
    if sid: cmd+=["-H","Mcp-Session-Id: "+sid]
    if dump_headers: cmd+=["-D",dump_headers]
    p=subprocess.Popen(cmd,stdout=subprocess.PIPE)
    out=[]
    try:
        for raw in p.stdout:
            line=raw.decode("utf-8","replace")
            out.append(line)
            if line.startswith("data:"):
                break
    finally:
        try: p.kill()
        except Exception: pass
    return "".join(out)
def parse(txt):
    out=[]
    for line in txt.splitlines():
        if line.startswith("data:"):
            out.append(json.loads(line[5:].strip()))
    if not out:
        try: return json.loads(txt)
        except Exception: return {"raw":txt}
    return out[-1]
def session():
    hdr=os.path.join(HERE,"_hdr.txt")
    post({"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"cc","version":"1"}}},dump_headers=hdr)
    sid=None
    for l in open(hdr,encoding="utf-8",errors="ignore"):
        if l.lower().startswith("mcp-session-id:"): sid=l.split(":",1)[1].strip()
    post({"jsonrpc":"2.0","method":"notifications/initialized"},sid)
    return sid
def tool_call(sid,name,args,i=2):
    return parse(post({"jsonrpc":"2.0","id":i,"method":"tools/call","params":{"name":name,"arguments":args}},sid))
def text_of(res):
    try:
        c=res["result"]["content"]
        return "\n".join(x.get("text","") for x in c)
    except Exception:
        return json.dumps(res,ensure_ascii=False)
if __name__=="__main__":
    mode=sys.argv[1]; sid=session()
    if mode=="describe":
        ts=sys.argv[2]; res=tool_call(sid,"describe_toolset",{"toolset_name":ts})
        t=text_of(res); fn=os.path.join(HERE,"desc_"+ts.split(".")[-1]+".json"); open(fn,"w",encoding="utf-8").write(t)
        try:
            d=json.loads(t); tools=d.get("tools",d)
            for tl in tools:
                sch=tl.get("inputSchema",{}); req=sch.get("required",[]); props=list(sch.get("properties",{}).keys())
                print(f"{tl['name']}  req={req}  all={props}")
        except Exception as e:
            print("saved",fn,len(t),"chars; parse err",e); print(t[:1500])
    elif mode=="call":
        ts=sys.argv[2]; tool=sys.argv[3]; args=json.loads(sys.argv[4]) if len(sys.argv)>4 else {}
        res=tool_call(sid,"call_tool",{"toolset_name":ts,"tool_name":tool,"arguments":args})
        t=text_of(res)
        if len(sys.argv)>5:
            open(sys.argv[5],"w",encoding="utf-8").write(t); print("saved",sys.argv[5],len(t))
        else:
            print(t if len(t)<20000 else t[:20000]+"\n...[truncated %d]"%len(t))
