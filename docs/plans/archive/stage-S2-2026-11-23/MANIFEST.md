# MANIFEST — S2 归档快照（2026-11-23）

> 生成者：acceptance（G2）｜阶段：S2（0 行事实链 MVP）｜归档时点：基线提交前（工作区实测）
> 用途：S2 计划/评审/测试/验收/进度/证据的不可变快照，供回溯；权威内容仍以仓库内原路径文件为准。

## 归档文件与 SHA256（归档时实测）

```text
64eb5b875dd4b86b6b763e2a2be2ecfc5eca5002299b441a3dfa2f533844bc9c  README.md
1f258ae18223694dfefeb39712878728610a33914b05b52eb82f56bf2653f1f3  00-master-plan.md
8c2b5753f0ef429a4e6a3a50687969217a65ed4a54ee2c60d1e5460a1f5c5920  SOLO-PLAN.md
bf602001ce0bf87bde93a8cc695e32a9edffc68b8612d03d1364cc13ffc51adc  stages/S2/dispatch.md
3816c16662f018cad1adad37ce6fa3dd5e369b2b0eaa77e8789245043c1b6928  stages/S2/dispatch-amendment-01.md
65f24eb2b15013060cb56bae05c22207d21b31bb558b0ac7a0dc6f8a5e7021bc  stages/S2/s2-plan.md
8d80895376306debbbd4a0f84670719d6a5fcf6d9a30d7514a8515bc85a988de  stages/S2/plan-review.md
206b7062531d77b39dd2471d740caf157520d4df5674b190b5c4e8ba7300655a  stages/S2/test-report.md
77488794ca54b539f682c87697272d550a8384a27251560a5391336bd771dc10  stages/S2/acceptance.md
f3b2cdd2444e448375f15e5b5f783e58331a1c0626442aeb4331be623884de64  stages/S2/progress.md
6029448a19d6f7bd6151acec527ffded37ed558a4c8d6f4987308f910fe8e359  stages/S2/evidence/workbench-s2.png
46c107cf61043aff00569eb12c8281aa6611e0209849851fe048b7172c2ce7fb  stages/S2/evidence/demo-s2.png
```

说明：

- 本目录内 12 个文件均是从原路径**复制**的快照，原文件未移动、未删除。
- `dispatch.md`、`s2-plan.md`、s2 fixture 三件与 G1 冻结基线一致（`plan-review.md` §2）；
  `dispatch-amendment-01.md` 为 S2-AMD-01 正式修订（单文件文案例外）。
- `acceptance.md`、`progress.md` 为**基线提交前**的快照：基线 commit 哈希与 tag 记录是在提交后追加到仓库原路径同名文件的
  （见 `docs/plans/stages/S2/acceptance.md` §13 与 git tag `s2-baseline`），故与归档副本存在预期内的少量差异。
- 复制时 `acceptance.md`/`progress.md` 的基线哈希行仍为占位符（`（首轮提交后由 G2 追加）`），属预期。
- `MANIFEST.md`、`SUMMARY.md` 为本归档自产文件，不参与上述哈希列表。
- 截图由 orchestrator 于 2026-11-23 12:31 采集；归档为字节级复制。

## 目录映射（归档 → 原路径）

| 归档路径 | 原路径 |
|---|---|
| `README.md` | `docs/plans/README.md` |
| `00-master-plan.md` | `docs/plans/00-master-plan.md` |
| `SOLO-PLAN.md` | `docs/plans/SOLO-PLAN.md` |
| `stages/S2/dispatch.md` | `docs/plans/stages/S2/dispatch.md` |
| `stages/S2/dispatch-amendment-01.md` | `docs/plans/stages/S2/dispatch-amendment-01.md` |
| `stages/S2/s2-plan.md` | `docs/plans/stages/S2/s2-plan.md` |
| `stages/S2/plan-review.md` | `docs/plans/stages/S2/plan-review.md` |
| `stages/S2/test-report.md` | `docs/plans/stages/S2/test-report.md` |
| `stages/S2/acceptance.md` | `docs/plans/stages/S2/acceptance.md` |
| `stages/S2/progress.md` | `docs/plans/stages/S2/progress.md` |
| `stages/S2/evidence/workbench-s2.png` | `docs/plans/stages/S2/evidence/workbench-s2.png` |
| `stages/S2/evidence/demo-s2.png` | `docs/plans/stages/S2/evidence/demo-s2.png` |

## 恢复方法（不要把归档目录当作工作目录）

```bash
# 全量恢复（会覆盖原路径，先确认工作区干净）
cp -r "docs/plans/archive/stage-S2-2026-11-23/." "docs/plans/"
# 仅恢复某一文件（示例）
cp "docs/plans/archive/stage-S2-2026-11-23/stages/S2/acceptance.md" "docs/plans/stages/S2/acceptance.md"
```

恢复后请以 git 历史与 tag `s2-baseline` 为准核对产品/契约/fixture 字节；归档只覆盖上述 12 个文件，不含代码与 fixture。
