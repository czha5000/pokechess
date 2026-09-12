"""皮卡丘眼睛/高光/腮红 6 片法线朝内(UE 单面剔除后不可见),翻成朝外并原地保存。
用法: blender.exe -b <source.blend> --python scripts/pikachu_fix_face_normals_v1.py"""
import bpy,bmesh
from mathutils import Vector
PARTS=['Pikachu_Cheek_L','Pikachu_Cheek_R','Pikachu_Eye_L','Pikachu_Eye_R','Pikachu_EyeHighlight_L','Pikachu_EyeHighlight_R']
head=bpy.data.objects['Pikachu_BodyHead']
hc=sum((head.matrix_world@v.co for v in head.data.vertices if (head.matrix_world@v.co).z>0.5),Vector())/sum(1 for v in head.data.vertices if (head.matrix_world@v.co).z>0.5)
def outward(ob):
    return sum(((ob.matrix_world@p.center-hc).normalized().dot((ob.matrix_world.to_3x3()@p.normal).normalized())>0) for p in ob.data.polygons)/len(ob.data.polygons)
for n in PARTS:
    ob=bpy.data.objects[n]; before=outward(ob)
    bm=bmesh.new(); bm.from_mesh(ob.data)
    for f in bm.faces: f.normal_flip()
    bm.to_mesh(ob.data); bm.free(); ob.data.update()
    print(f"{n:26s} outward {before:.2f} -> {outward(ob):.2f}")
bpy.ops.wm.save_mainfile()
print("saved", bpy.data.filepath)
