# MANIFEST — S1 归档快照（2026-11-23）

> 生成者：acceptance（G2）｜阶段：S1｜归档时点：基线提交前（工作区实测）
> 用途：S1 计划/评审/测试/验收/进度的不可变快照，供回溯；权威内容仍以仓库内原路径文件为准。

## 归档文件与 SHA256（归档时实测）

```text
1f258ae18223694dfefeb39712878728610a33914b05b52eb82f56bf2653f1f3  00-master-plan.md
64eb5b875dd4b86b6b763e2a2be2ecfc5eca5002299b441a3dfa2f533844bc9c  README.md
8c2b5753f0ef429a4e6a3a50687969217a65ed4a54ee2c60d1e5460a1f5c5920  SOLO-PLAN.md
4dc550dc1b51bbb6a0c46761dbb80b2bf07735a04aa3f9dbae5676d0ddc7c468  stages/S1/acceptance.md
da9960fb497f564b1eff1a3b72afabe2ad3356a11df945513b0452e717b12668  stages/S1/dispatch.md
ff4948b8dbcec0caf659e0e60197d0248fb3d03d69b9472faeb9fd1781296c79  stages/S1/evidence/workbench-s1.png
ae605f61d4ecb8e44083a2c87b0ff9c8fe8a367a039ad0a952941cbd74f9cb51  stages/S1/plan-review.md
30db9acd3ea1cd486873ec17da44456d5ef8624749095bf1b3a64d356d9b2d30  stages/S1/progress.md
01c5c75b360ba7af576602cf1172dad3c0b18c97f81274e03f5bf25ed3d9e5e4  stages/S1/s1-plan.md
514c67d6cf3d7bb9427a7b7a45cce58c40a59090cc6aa3ed801b5bf42a837db7  stages/S1/test-report.md
```

说明：

- 本目录内 10 个文件均是从原路径**复制**的快照，原文件未移动、未删除。
- `acceptance.md`、`progress.md` 为**基线提交前**的快照：基线 commit 哈希与 tag 记录是在提交后追加到仓库原路径同名文件的
  （见 `docs/plans/stages/S1/acceptance.md` §13 与 git tag `s1-baseline`），故与归档副本存在预期内的少量差异。
- 复制时 `acceptance.md`/`progress.md` 的基线哈希行尚为占位符（`（首轮提交后由 G2 追加）`），属预期。
- `MANIFEST.md`、`SUMMARY.md` 为本归档自产文件，不参与上述哈希列表。

## 目录映射（归档 → 原路径）

| 归档路径 | 原路径 |
|---|---|
| `README.md` | `docs/plans/README.md` |
| `00-master-plan.md` | `docs/plans/00-master-plan.md` |
| `SOLO-PLAN.md` | `docs/plans/SOLO-PLAN.md` |
| `stages/S1/dispatch.md` | `docs/plans/stages/S1/dispatch.md` |
| `stages/S1/s1-plan.md` | `docs/plans/stages/S1/s1-plan.md` |
| `stages/S1/plan-review.md` | `docs/plans/stages/S1/plan-review.md` |
| `stages/S1/test-report.md` | `docs/plans/stages/S1/test-report.md` |
| `stages/S1/acceptance.md` | `docs/plans/stages/S1/acceptance.md` |
| `stages/S1/progress.md` | `docs/plans/stages/S1/progress.md` |
| `stages/S1/evidence/workbench-s1.png` | `docs/plans/stages/S1/evidence/workbench-s1.png` |

## 恢复方法（不要把归档目录当作工作目录）

```bash
# 全量恢复（会覆盖原路径，先确认工作区干净）
cp -r "docs/plans/archive/stage-S1-2026-11-23/." "docs/plans/"
# 仅恢复某一文件（示例）
cp "docs/plans/archive/stage-S1-2026-11-23/stages/S1/acceptance.md" "docs/plans/stages/S1/acceptance.md"
# 校验（在归档目录内执行，应与上表逐行一致）
sha256sum -c <(sed -n '/^```text$/,/^```$/p' MANIFEST.md | grep -E '^[0-9a-f]{64}')
```

注意：恢复后 `acceptance.md`/`progress.md` 会缺少基线 commit 哈希追加行，属预期；以 `git show s1-baseline` 与仓库内最新文件为准。
