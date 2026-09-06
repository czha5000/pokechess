# 纹兽战记四足管线入口。
# 用法:
#   powershell -ExecutionPolicy Bypass -File art-pipeline/run_pipeline.ps1
#   powershell -ExecutionPolicy Bypass -File art-pipeline/run_pipeline.ps1 -Step inspect
param(
    [ValidateSet("all", "inspect", "rigify", "walk", "unirig")]
    [string]$Step = "all"
)

$ErrorActionPreference = "Stop"
# 无论从哪一目录启动,都定位到本脚本所在的 art-pipeline
$PipeRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent $PipeRoot
$Blender = "C:\Program Files\Blender Foundation\Blender 5.2\blender.exe"
$Scripts = Join-Path $PipeRoot "scripts"
$OutDir = Join-Path $PipeRoot "output"
$Reports = Join-Path $PipeRoot "reports"

if (-not (Test-Path $Blender)) {
    throw "找不到 Blender: $Blender"
}

New-Item -ItemType Directory -Force -Path $OutDir, $Reports | Out-Null

function Invoke-BlenderScript {
    param([string]$ScriptName, [string[]]$ExtraArgs)
    $scriptPath = Join-Path $Scripts $ScriptName
    Write-Host "=== Blender $ScriptName ==="
    & $Blender --background --python $scriptPath -- @ExtraArgs
    if ($LASTEXITCODE -ne 0) {
        throw "$ScriptName failed with exit $LASTEXITCODE"
    }
}

if ($Step -eq "all" -or $Step -eq "inspect") {
    $inputGlb = Join-Path $RepoRoot "eevee-4view\Hy3D_mv_grey.glb"
    Invoke-BlenderScript "01_inspect_remesh.py" @(
        "--input", $inputGlb,
        "--out-dir", $OutDir,
        "--report", (Join-Path $Reports "01_topo.json")
    )
}

if ($Step -eq "all" -or $Step -eq "unirig") {
    Write-Host "=== UniRig gate ==="
    python (Join-Path $Scripts "02b_unirig_gate.py")
}

if ($Step -eq "all" -or $Step -eq "rigify") {
    Invoke-BlenderScript "02_rigify_quad.py" @(
        "--blend", (Join-Path $OutDir "eevee_remesh.blend"),
        "--out-dir", $OutDir,
        "--report", (Join-Path $Reports "02_rigify.json")
    )
}

if ($Step -eq "all" -or $Step -eq "walk") {
    Invoke-BlenderScript "03_walk_cycle.py" @(
        "--blend", (Join-Path $OutDir "eevee_rigify.blend"),
        "--out-dir", $OutDir,
        "--report", (Join-Path $Reports "03_walk.json")
    )
}

Write-Host "Pipeline step '$Step' finished."
