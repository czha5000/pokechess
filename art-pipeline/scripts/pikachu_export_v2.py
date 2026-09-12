"""皮卡丘 v1 正式导出(v2):源 = magic_discharge/pikachu_v1_magic_discharge.blend(Magic 放电版 81 帧 + 眼睛/腮红法线已修),
七个 clip 全部烘焙导出,参数与 pikachu_export_v1.py 完全一致。上一版 FBX 备份到 fbx/backup_pre_discharge/。用法:
  blender.exe -b output/pikachu/v1/animation/magic_discharge/pikachu_v1_magic_discharge.blend --python scripts/pikachu_export_v2.py"""
import bpy,json,math,hashlib
from pathlib import Path
from mathutils import Matrix,Vector
from mathutils.kdtree import KDTree
OUT=Path(r'C:\Users\AI_Work\Claude\Projects\game\纹兽战记\art-pipeline\output\pikachu\v1\animation')
CLIPS={'Idle':61,'Walk':25,'WalkBackward':31,'Attack':37,'Magic':81,'Hurt':25,'Death':61}

def signature(objects):
    rows=[]
    for ob in objects:
        for v in ob.data.vertices:
            weights=sorted((ob.vertex_groups[g.group].name,round(g.weight,6)) for g in v.groups if g.weight>1e-6)
            rows.append((tuple(round(x,6) for x in (ob.matrix_world@v.co)),weights))
    return hashlib.sha256(repr(sorted(rows)).encode()).hexdigest()

def export():
    import shutil;bk=OUT/'fbx'/'backup_pre_discharge';bk.mkdir(exist_ok=True)
    for c in CLIPS:
        old=OUT/'fbx'/('PikachuV1_'+c+'.fbx')
        if old.exists() and not (bk/old.name).exists():shutil.copy2(old,bk/old.name)
    source=bpy.data.objects['Pikachu_ControlRig'];s=bpy.context.scene;parts=[o for o in s.objects if o.get('pikachu_skin')]
    bones=[b.name for b in source.data.bones if b.use_deform];samples={}
    for clip,end in CLIPS.items():
        source.animation_data.action=bpy.data.actions['Pikachu_'+clip];frames=[]
        for f in range(1,end+1):
            s.frame_set(f);bpy.context.view_layer.update();frames.append({n:source.pose.bones[n].matrix.copy() for n in bones})
        samples[clip]=frames
    source.data.pose_position='REST';source.animation_data.action=None
    collection=bpy.data.collections.new('PikachuV1_Baked_Export');s.collection.children.link(collection)
    arm=source.copy();arm.data=source.data.copy();arm.animation_data_clear();arm.name='PikachuV1_Skeleton';arm.data.name='PikachuV1_ExportSkeleton';collection.objects.link(arm)
    bpy.ops.object.select_all(action='DESELECT');arm.select_set(True);bpy.context.view_layer.objects.active=arm;bpy.ops.object.mode_set(mode='EDIT')
    for b in list(arm.data.edit_bones):
        if not b.use_deform:arm.data.edit_bones.remove(b)
    bpy.ops.object.mode_set(mode='OBJECT')
    for pb in arm.pose.bones:
        for c in list(pb.constraints):pb.constraints.remove(c)
        pb.matrix_basis=Matrix.Identity(4);pb.rotation_mode='QUATERNION'
    copies=[]
    for ob in parts:
        copy=ob.copy();copy.data=ob.data.copy();copy.animation_data_clear();collection.objects.link(copy);copy.parent=arm;copy.matrix_world=ob.matrix_world.copy();copy.name=ob.name+'_ExportPart'
        if 'pikachu_skin' in copy:del copy['pikachu_skin']
        for mod in copy.modifiers:
            if mod.type=='ARMATURE':mod.object=arm;mod.use_deform_preserve_volume=False
        copies.append(copy)
    bpy.context.view_layer.update();sig_before=signature(parts)
    bpy.ops.object.select_all(action='DESELECT')
    for ob in copies:ob.select_set(True)
    bpy.context.view_layer.objects.active=copies[0];bpy.ops.object.join();mesh=bpy.context.object;mesh.name='PikachuV1'
    sig_after=signature([mesh])
    if sig_before!=sig_after:raise RuntimeError('Join changed rest coordinates or weights')
    arm.data.pose_position='POSE';source.data.pose_position='POSE';arm.animation_data_create();pose_error=0;vertex_error=0;paths={}
    for clip,frames in samples.items():
        action=bpy.data.actions.new('PikachuV1_'+clip);action.use_fake_user=True;action['fps']=30;action['loop']=clip in ['Idle','Walk','WalkBackward'];arm.animation_data.action=action
        for frame,poses in enumerate(frames,1):
            for n in bones:
                b=arm.data.bones[n]
                if b.parent:basis=(b.parent.matrix_local.inverted()@b.matrix_local).inverted()@(poses[b.parent.name].inverted()@poses[n])
                else:basis=b.matrix_local.inverted()@poses[n]
                pb=arm.pose.bones[n];pb.location,pb.rotation_quaternion,pb.scale=basis.decompose()
                for prop in ['location','rotation_quaternion','scale']:pb.keyframe_insert(prop,frame=frame,group=n)
        for layer in action.layers:
            for strip in layer.strips:
                for bag in strip.channelbags:
                    for fc in bag.fcurves:
                        for kp in fc.keyframe_points:kp.interpolation='LINEAR'
        source.animation_data.action=bpy.data.actions['Pikachu_'+clip]
        for frame,poses in enumerate(frames,1):
            s.frame_set(frame);bpy.context.view_layer.update()
            for n in bones:pose_error=max(pose_error,max(abs(arm.pose.bones[n].matrix[i][j]-poses[n][i][j]) for i in range(4) for j in range(4)))
            if frame in [1,(len(frames)+1)//2,len(frames)]:
                dg=bpy.context.evaluated_depsgraph_get();points=[]
                for ob in parts:
                    ev=ob.evaluated_get(dg);me=ev.to_mesh();points.extend((ob.matrix_world@v.co).copy() for v in me.vertices);ev.to_mesh_clear()
                tree=KDTree(len(points))
                for i,p in enumerate(points):tree.insert(p,i)
                tree.balance();ev=mesh.evaluated_get(dg);me=ev.to_mesh()
                for v in me.vertices:vertex_error=max(vertex_error,tree.find(mesh.matrix_world@v.co)[2])
                ev.to_mesh_clear()
        if pose_error>2e-5 or vertex_error>2e-5:raise RuntimeError(('Baked parity failed',pose_error,vertex_error))
        s.frame_start=1;s.frame_end=len(frames);s.frame_set(1)
        bpy.ops.object.select_all(action='DESELECT');arm.select_set(True);mesh.select_set(True);bpy.context.view_layer.objects.active=arm
        arm.rotation_euler.z=-math.pi/2;bpy.context.view_layer.update();path=OUT/'fbx'/('PikachuV1_'+clip+'.fbx')
        bpy.ops.export_scene.fbx(filepath=str(path),use_selection=True,object_types={'ARMATURE','MESH'},
            add_leaf_bones=False,bake_anim=True,bake_anim_use_all_actions=False,bake_anim_use_nla_strips=False,
            bake_anim_force_startend_keying=True,bake_anim_simplify_factor=0,bake_anim_step=1,
            armature_nodetype='NULL',use_armature_deform_only=True,
            global_scale=1,apply_unit_scale=True,apply_scale_options='FBX_SCALE_NONE',
            axis_forward='-Z',axis_up='Y',path_mode='COPY',embed_textures=True)
        arm.rotation_euler.z=0;bpy.context.view_layer.update()
        paths[clip]={'path':str(path),'frames':[1,len(frames)],'duration_s':(len(frames)-1)/30,'loop':clip in ['Idle','Walk','WalkBackward'],'fps':30,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
    arm.animation_data.action=bpy.data.actions['PikachuV1_Idle'];s.frame_start=1;s.frame_end=61;s.frame_set(1)
    source.animation_data.action=bpy.data.actions['Pikachu_Idle'];source.hide_render=True;source.hide_set(True)
    for o in parts:o.hide_render=True;o.hide_set(True)
    # This is a file copy: all source objects can still be restored in the live scene.
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'pikachu_v1_baked_export.blend'),copy=True)
    for o in parts:o.hide_render=False;o.hide_set(False)
    source.hide_render=False;source.hide_set(False);collection.hide_render=True;collection.hide_viewport=True
    bbox=[v.co for v in mesh.data.vertices];low=[min(v[i] for v in bbox) for i in range(3)];high=[max(v[i] for v in bbox) for i in range(3)]
    hierarchy=[{'name':b.name,'parent':b.parent.name if b.parent else None,'head_m':list(b.head_local),'tail_m':list(b.tail_local)} for b in arm.data.bones]
    report={'state':'BLENDER_BAKE_AND_EXPORT_VALIDATED_UE_PENDING','files':paths,'skeleton_object':'PikachuV1_Skeleton','root_bone':'root','bone_count':len(bones),'bones':hierarchy,'vertices':len(mesh.data.vertices),'material_slots':[m.name for m in mesh.data.materials],'reference_bounds_m':{'min':low,'max':high,'size':[high[i]-low[i] for i in range(3)]},'reference_min_z_cm':low[2]*100,'fps':30,'source_forward':[0,1,0],'export_forward':[1,0,0],'export_root_z_rotation_degrees':-90,'unit_policy':'meter authoring; global_scale=1, apply_unit_scale=True, FBX_SCALE_NONE writes centimeter numbers','skinning':'LINEAR','max_influences':max(sum(g.weight>1e-6 for g in v.groups) for v in mesh.data.vertices),'weight_rest_signature_equal':sig_before==sig_after,'all_301_frame_pose_matrix_error':pose_error,'sampled_21_frame_mesh_vertex_error_m':vertex_error,'export_constraints':sum(len(p.constraints) for p in arm.pose.bones),'export_control_bones':sum(n.startswith('CTRL_') for n in bones),'source_file':str(OUT/'magic_discharge'/'pikachu_v1_magic_discharge.blend'),'export_copy':str(OUT/'pikachu_v1_baked_export.blend')}
    (OUT/'export_manifest.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({k:v for k,v in report.items() if k not in ['bones','files']},indent=2));return report


export()
