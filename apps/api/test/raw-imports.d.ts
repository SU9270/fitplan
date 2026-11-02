// Vite `?raw` imports (file contents as a string), e.g. the shipped data/usda-zh.csv.
declare module '*?raw' {
  const text: string;
  export default text;
}
