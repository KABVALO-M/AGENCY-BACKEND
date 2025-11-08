declare module 'shpjs/dist/shp.js' {
  const shp: (input: ArrayBuffer | Buffer | Blob | string) => Promise<any>;
  export default shp;
}
