# -*- coding: utf-8 -*-
"""
add_species.py —— 按《UE角色资产规范.md》一键把一只角色接进 DT_Species。

前提:资产已经按规范放好(见 --check 会逐个核对):
    /Game/Characters/<Species>/SK_<Species>            (+ _Skeleton, _PhysicsAsset 可选)
    /Game/Characters/<Species>/Animations/A_<Species>_{Idle,Walk,WalkBackward,Attack,Magic,Hurt,Death}
它做的事:
    1. 核对 8 个资产存在且类型正确(SkeletalMesh / AnimSequence)
    2. 量网格 bounds,按 Z = -88 - minZ*scale 算挂载高度(88 = BP_Unit 胶囊半高)
    3. DataTableTools.add_rows + set_rows 写一行(已存在就只 set)
    4. 追加/更新 js/data/ue_import/DT_Species.csv,并复制到 UE 工程 Saved/Import/
    5. 提醒你做朝向 A/B(脚本不替你判朝向,见规范第 4 步)

用法(编辑器开着、MCP 8001 通、PIE 没在跑):
    python ue/tools/add_species.py pikachu 皮卡丘 --hp 20 --atk 14 --def 5 --spd 11 --mov 6 --rng 2 --type 0 --scale 1 --yaw 0
    python ue/tools/add_species.py pikachu --check      # 只核对资产,不写表
"""
import argparse, json, os, sys, io, re, shutil

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import mcp_http as mcp  # noqa: E402

ACTIONS = ["Idle", "Walk", "WalkBackward", "Attack", "Magic", "Hurt", "Death"]
CAPSULE_HALF_HEIGHT = 88.0
DT = "/Game/Data/DT_Species.DT_Species"
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
CSV = os.path.join(REPO, "js", "data", "ue_import", "DT_Species.csv")
UE_IMPORT = os.environ.get("UE_IMPORT_DIR", r"C:\Users\AI_Work\Documents\Unreal Projects\MyProject 5.8\Saved\Import")
A = "editor_toolset.toolsets.asset.AssetTools"
SK = "editor_toolset.toolsets.skeletal_mesh.SkeletalMeshTools"
DTT = "editor_toolset.toolsets.data_table.DataTableTools"


def call(sid, ts, tool, args):
    r = mcp.tool_call(sid, "call_tool", {"toolset_name": ts, "tool_name": tool, "arguments": args})
    t = mcp.text_of(r)
    try:
        return json.loads(t)["returnValue"]
    except Exception:
        return t


def species_paths(species_id):
    S = species_id[0].upper() + species_id[1:]
    C = f"/Game/Characters/{S}"
    mesh = f"{C}/SK_{S}"
    anims = {a: f"{C}/Animations/A_{S}_{a}" for a in ACTIONS}
    return S, C, mesh, anims


def check(sid, species_id):
    S, C, mesh, anims = species_paths(species_id)
    ok = True
    cls = call(sid, A, "get_asset_class", {"asset_path": mesh})
    print(("OK " if cls == "SkeletalMesh" else "BAD"), mesh, cls)
    ok &= cls == "SkeletalMesh"
    for a, p in anims.items():
        cls = call(sid, A, "get_asset_class", {"asset_path": p})
        print(("OK " if cls == "AnimSequence" else "BAD"), p, cls)
        ok &= cls == "AnimSequence"
    return ok


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("species_id", help="行名 = 目录名小写,例如 pikachu")
    ap.add_argument("display_name", nargs="?", help="中文名,例如 皮卡丘")
    ap.add_argument("--check", action="store_true", help="只核对资产")
    for k, d in [("hp", 20), ("atk", 10), ("def", 5), ("spd", 6), ("mov", 5), ("rng", 1), ("type", 0)]:
        ap.add_argument("--" + k, type=int, default=d)
    ap.add_argument("--scale", type=float, default=1.0, help="MeshRelativeScale(三轴同值)")
    ap.add_argument("--yaw", type=float, default=0.0, help="MeshRelativeRotation.Yaw,先用 A/B 拍照定(见规范)")
    ap.add_argument("--z", type=float, default=None, help="手动指定 Z;缺省按 bounds 自动算")
    args = ap.parse_args()

    sid = mcp.session()
    if call(sid, "EditorToolset.EditorAppToolset", "IsPIERunning", {}):
        sys.exit("PIE 正在跑,先停掉(资产/表操作在 PIE 期间会被拒)")
    if not check(sid, args.species_id):
        sys.exit("资产不齐或类型不对,先按规范整理")
    if args.check:
        return
    if not args.display_name:
        sys.exit("需要 display_name")

    S, C, mesh, anims = species_paths(args.species_id)
    b = call(sid, SK, "get_bounds", {"mesh": {"refPath": f"{mesh}.SK_{S}"}})
    min_z = b["origin"]["z"] - b["boxExtent"]["z"]
    height = 2 * b["boxExtent"]["z"] * args.scale
    z = args.z if args.z is not None else round(-CAPSULE_HALF_HEIGHT - min_z * args.scale, 3)
    print(f"bounds: minZ={min_z:.2f} 局部高={2*b['boxExtent']['z']:.1f} → 游戏内高≈{height:.1f} cm, Z={z}")
    if height < 60 or height > 160:
        print("⚠ 游戏内高度不在 60–160 cm 常见区间,检查 --scale(超梦灰模 54.294、厘米网格 1)")

    row = {"displayName": args.display_name, "maxHP": args.hp, "atk": args.atk, "def": getattr(args, "def"),
           "spd": args.spd, "moveRange": args.mov, "atkRange": args.rng, "atkType": args.type,
           "mesh": f"{mesh}.SK_{S}",
           "idleAnim": f"{anims['Idle']}.A_{S}_Idle", "walkForwardAnim": f"{anims['Walk']}.A_{S}_Walk",
           "walkBackwardAnim": f"{anims['WalkBackward']}.A_{S}_WalkBackward", "attackAnim": f"{anims['Attack']}.A_{S}_Attack",
           "magicAnim": f"{anims['Magic']}.A_{S}_Magic", "hurtAnim": f"{anims['Hurt']}.A_{S}_Hurt", "deathAnim": f"{anims['Death']}.A_{S}_Death",
           "meshRelativeLocation": {"x": 0, "y": 0, "z": z},
           "meshRelativeRotation": {"pitch": 0, "yaw": args.yaw, "roll": 0},
           "meshRelativeScale": {"x": args.scale, "y": args.scale, "z": args.scale}}
    existing = call(sid, DTT, "list_rows", {"data_table": {"refPath": DT}}) or []
    if args.species_id not in existing:
        call(sid, DTT, "add_rows", {"data_table": {"refPath": DT}, "row_names": [args.species_id]})
    call(sid, DTT, "set_rows", {"data_table": {"refPath": DT}, "values": json.dumps({args.species_id: row}, ensure_ascii=False)})
    back = call(sid, DTT, "get_rows", {"data_table": {"refPath": DT}, "row_names": [args.species_id]})
    print("表已写入:", str(back)[:200], "...")
    call(sid, A, "save_assets", {"asset_paths": []})

    # CSV 备档(资产才是真相,CSV 只是备份)
    anim_cols = ",".join(f"{anims[a]}.A_{S}_{a}" for a in ACTIONS)
    line = (f'{args.species_id},{args.display_name},{args.hp},{args.atk},{getattr(args, "def")},{args.spd},{args.mov},{args.rng},{args.type},'
            f'{mesh}.SK_{S},{anim_cols},"(X=0,Y=0,Z={z})","(Pitch=0,Yaw={args.yaw},Roll=0)","(X={args.scale},Y={args.scale},Z={args.scale})"')
    lines = io.open(CSV, encoding="utf-8-sig").read().splitlines() if os.path.exists(CSV) else []
    lines = [l for l in lines if not l.startswith(args.species_id + ",")]
    lines.append(line)
    io.open(CSV, "w", encoding="utf-8-sig", newline="\n").write("\n".join(lines) + "\n")
    if os.path.isdir(UE_IMPORT):
        shutil.copy(CSV, os.path.join(UE_IMPORT, "DT_Species.csv"))
    print("CSV 已更新:", CSV)
    print("\n下一步(脚本不做):1) 朝向 A/B 拍照确认 Yaw;2) 把 id 填进 DBG 阵容或 DefaultAllyRoster 开 PIE 看一眼;3) 更新 UE蓝图状态.md 的 DT_Species 表格。")


if __name__ == "__main__":
    main()
