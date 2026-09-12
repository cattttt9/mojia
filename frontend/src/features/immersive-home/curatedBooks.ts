import { demoBooks } from "../../mockData";
import type { ShelfBook } from "../../types";

const additions: Array<[string, string, string]> = [
  ["活着", "余华", "文学"],
  ["额尔古纳河右岸", "迟子建", "文学"],
  ["平凡的世界", "路遥", "文学"],
  ["沉默的大多数", "王小波", "文学"],
  ["娱乐至死", "尼尔·波兹曼", "社会科学"],
  ["人间词话", "王国维", "文学"],
  ["苏菲的世界", "乔斯坦·贾德", "哲学宗教"],
  ["海边的卡夫卡", "村上春树", "文学"],
  ["霍乱时期的爱情", "加西亚·马尔克斯", "文学"],
  ["你一生的故事", "特德·姜", "科幻"],
  ["人类群星闪耀时", "斯蒂芬·茨威格", "历史"],
  ["鱼不存在", "露露·米勒", "科学技术"],
];

const extraBooks: ShelfBook[] = additions.map(
  ([title, author, category], index) => ({
    id: `featured-extra-${index + 1}`,
    title,
    author,
    category,
    finished: false,
    lastRead: 0,
  }),
);

/** 首页精选池只用于游客展示和个人书架不足时的视觉补齐。 */
export const curatedBooks: ShelfBook[] = [...demoBooks, ...extraBooks];
