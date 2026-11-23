# MANIFEST — S3 归档快照（2026-11-23）

> 生成者：acceptance（G2）｜阶段：S3（前端事实 + 只读回放 MVP）｜归档时点：基线提交前（工作区实测）
> 用途：S3 计划/评审/测试/验收/进度/证据的不可变快照，供回溯；权威内容仍以仓库内原路径文件为准。

## 归档文件与 SHA256（归档时实测）

```text
64eb5b875dd4b86b6b763e2a2be2ecfc5eca5002299b441a3dfa2f533844bc9c  README.md
1f258ae18223694dfefeb39712878728610a33914b05b52eb82f56bf2653f1f3  00-master-plan.md
8c2b5753f0ef429a4e6a3a50687969217a65ed4a54ee2c60d1e5460a1f5c5920  SOLO-PLAN.md
e8a756c05ae5e73c4f2cf97f408ec81985b205aeabd71d188d0d3ae7daa62e14  stages/S3/dispatch.md
84a2fdf81735f0bc710f7973314c5867ceb9b0a8bcb4341a7d7d2e77e9e9769c  stages/S3/s3-plan.md
66777f6633a29c9ca1ab4bce0adb47acd3ab28f7d8e163d04964cd2abe8c5a34  stages/S3/plan-review.md
acdcb40e6614b546b89dd14064bb1019e8e2716c83c2da2b902623ec73f551b6  stages/S3/test-report.md
d2cc9d3c7da7d2eca9ad8308b442f7ff3d4d1e2ba3b0514db3ccc557fa8b4ea2  stages/S3/acceptance.md
3efdb8d5262b892b867b376c05461077b3bbe7ad587cffe4c51ed8830c318989  stages/S3/progress.md
c2ff65e552b020a1bba0072df4f3689120d51e311f77bde33307367ad4912768  evidence/workbench-s3-case-a.png
80355b39894c4dfcb752ab792a60b8e2e3b01d8479d24d4c424ec6a9bc967dd9  evidence/workbench-s3-case-b.png
d505e4f5e0aba86ee7e71d658a7d28d97a4052c4b226291cbc96e3ffc3f92fd8  evidence/workbench-s3-replay.png
```

说明：

- 本目录内 12 个文件均是从原路径**复制**的快照，原文件未移动、未删除。
- `dispatch.md`、`s3-plan.md`、`plan-review.md` 与 G1 冻结基线一致（`plan-review.md` §2 的 22 项哈希中包含前两者）。
- `acceptance.md`、`progress.md` 为**基线提交前**的快照：基线 commit 哈希与 tag 记录是在提交后追加到仓库原路径同名文件的
  （见 `docs/plans/stages/S3/acceptance.md` §13、`progress.md` 的“基线记录”，以及 git tag `s3-baseline`），
  故归档副本与提交后的原文件存在预期内的少量差异（`（提交后由 G2 追加）` 占位）。
- `test-report.md` 为 tester 定稿版本（51/51）；`README.md`/`00-master-plan.md`/`SOLO-PLAN.md` 为存档时点的计划入口与主计划副本。
- `MANIFEST.md`、`SUMMARY.md` 为本归档自产文件，不参与上述哈希列表。
- 截图由 orchestrator 于 S3 证据采集阶段拍摄（`docs/plans/stages/S3/evidence/`），归档为字节级复制。

## 目录映射（归档 → 原路径）

| 归档路径 | 原路径 |
|---|---|
| `README.md` | `docs/plans/README.md` |
| `00-master-plan.md` | `docs/plans/00-master-plan.md` |
| `SOLO-PLAN.md` | `docs/plans/SOLO-PLAN.md` |
| `stages/S3/dispatch.md` | `docs/plans/stages/S3/dispatch.md` |
| `stages/S3/s3-plan.md` | `docs/plans/stages/S3/s3-plan.md` |
| `stages/S3/plan-review.md` | `docs/plans/stages/S3/plan-review.md` |
| `stages/S3/test-report.md` | `docs/plans/stages/S3/test-report.md` |
| `stages/S3/acceptance.md` | `docs/plans/stages/S3/acceptance.md` |
| `stages/S3/progress.md` | `docs/plans/stages/S3/progress.md` |
| `evidence/workbench-s3-case-a.png` | `docs/plans/stages/S3/evidence/workbench-s3-case-a.png` |
| `evidence/workbench-s3-case-b.png` | `docs/plans/stages/S3/evidence/workbench-s3-case-b.png` |
| `evidence/workbench-s3-replay.png` | `docs/plans/stages/S3/evidence/workbench-s3-replay.png` |

## 恢复方法（不要把归档目录当作工作目录）

```bash
# 全量恢复（会覆盖原路径，先确认工作区干净）
cp -r "docs/plans/archive/stage-S3-2026-11-23/." "docs/plans/"
# 仅恢复某一文件（示例）
cp "docs/plans/archive/stage-S3-2026-11-23/stages/S3/acceptance.md" "docs/plans/stages/S3/acceptance.md"
# 截图需回到原证据目录
cp "docs/plans/archive/stage-S3-2026-11-23/evidence/"*.png "docs/plans/stages/S3/evidence/"
```

恢复后请以 git 历史与 tag `s3-baseline` 为准核对产品/契约/fixture 字节；归档只覆盖上述 12 个文件，不含代码与 fixture。
