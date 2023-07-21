/**
 * 用于本地开发调试TS
 */

require("./hack.js");

require("ts-node").register({
  project: `${__dirname}/tsconfig.json`,
  require: ["tsconfig-paths/register"],
});

require(`${__dirname}/src/cli`);
