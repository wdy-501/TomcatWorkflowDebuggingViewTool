# MANIFEST — S0 归档快照（2026-11-23）

> 生成者：acceptance（G2）｜阶段：S0｜归档时点：基线提交前（工作区实测）
> 用途：S0 计划/契约评审/测试/验收/进度的不可变快照，供回溯；权威内容仍以仓库内原路径文件为准。

## 归档文件与 SHA256（归档时实测）

```text
1f258ae18223694dfefeb39712878728610a33914b05b52eb82f56bf2653f1f3  00-master-plan.md
64eb5b875dd4b86b6b763e2a2be2ecfc5eca5002299b441a3dfa2f533844bc9c  README.md
8c2b5753f0ef429a4e6a3a50687969217a65ed4a54ee2c60d1e5460a1f5c5920  SOLO-PLAN.md
c63c8594a51854d79dd1296032e8b25698216317b33a0d9a42b973c44dc7f9e0  stages/S0/acceptance.md
b9c594a4cdcc0abdd01705e519a33debbbde95e332d59bd5565770cfbb60ca56  stages/S0/dispatch.md
6f9060c9d92a8912239247379a8c520369ebf217e61224f9b1e15343c4a19692  stages/S0/evidence/demo-s0.png
f92d143bb3ff9ecaabbaa712846c7c762bb0ed0c5d61ef0bbe261b439bea3483  stages/S0/evidence/workbench-s0.png
1c3543833977f1bd0344730b1721db87b91a96f9f9b129125f60b050d2b059a6  stages/S0/plan-review.md
d61f5d0933d337efd69b8946548ece06e14d145eda8c810fe4294d697955bb2b  stages/S0/progress.md
5e0e0fa95fc8347809306c3c19b64f6f38f1ed26a277e3bc0e993b01e9d6138a  stages/S0/s0-plan.md
78f19ed591546a417e762c45748797bf0b0eb5d9abc3359c41511e2756f0ff75  stages/S0/test-report.md
```

说明：

- 本目录内 11 个文件均是从原路径**复制**的快照，原文件未移动、未删除。
- `acceptance.md`、`progress.md` 为**基线提交前**的快照：基线 commit 哈希与 tag 记录是在提交后追加到仓库原路径同名文件的（见 `docs/plans/stages/S0/acceptance.md` §8 与 git tag `s0-baseline`），故与归档副本存在预期内的少量差异。
- `MANIFEST.md`、`SUMMARY.md` 为本归档自产文件，不参与上述哈希列表。

## 目录映射（归档 → 原路径）

| 归档路径 | 原路径 |
|---|---|
| `README.md` | `docs/plans/README.md` |
| `00-master-plan.md` | `docs/plans/00-master-plan.md` |
| `SOLO-PLAN.md` | `docs/plans/SOLO-PLAN.md` |
| `stages/S0/dispatch.md` | `docs/plans/stages/S0/dispatch.md` |
| `stages/S0/s0-plan.md` | `docs/plans/stages/S0/s0-plan.md` |
| `stages/S0/plan-review.md` | `docs/plans/stages/S0/plan-review.md` |
| `stages/S0/test-report.md` | `docs/plans/stages/S0/test-report.md` |
| `stages/S0/acceptance.md` | `docs/plans/stages/S0/acceptance.md` |
| `stages/S0/progress.md` | `docs/plans/stages/S0/progress.md` |
| `stages/S0/evidence/workbench-s0.png` | `docs/plans/stages/S0/evidence/workbench-s0.png` |
| `stages/S0/evidence/demo-s0.png` | `docs/plans/stages/S0/evidence/demo-s0.png` |

## 恢复方法（不要把归档目录当作工作目录）

```bash
# 全量恢复（会覆盖原路径，先确认工作区干净）
cp -r "docs/plans/archive/stage-S0-2026-11-23/." "docs/plans/"
# 仅恢复某一文件（示例）
cp "docs/plans/archive/stage-S0-2026-11-23/stages/S0/acceptance.md" "docs/plans/stages/S0/acceptance.md"
# 校验（在归档目录内执行，应与上表逐行一致）
sha256sum -c <(sed -n '/^```text$/,/^```$/p' MANIFEST.md | grep -E '^[0-9a-f]{64}')
```

注意：恢复后 `acceptance.md`/`progress.md` 会缺少基线 commit 哈希追加行，属预期；以 `git show s0-baseline` 与仓库内最新文件为准。
