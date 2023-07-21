/**
 * 数组去重
 */
export const uniq = (arr: any[]): any[] => {
  return Array.from(new Set(arr));
};
