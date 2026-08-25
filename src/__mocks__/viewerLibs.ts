export const PptxViewer = () => null;
export const renderAsync = async () => {};
export const read = () => ({ SheetNames: [], Sheets: {} });
export const utils = { sheet_to_json: () => [] };
export const GlobalWorkerOptions = { workerSrc: "" };
export const getDocument = () => ({
  promise: Promise.resolve({ numPages: 0, getPage: () => Promise.resolve({}) }),
});
export default PptxViewer;
