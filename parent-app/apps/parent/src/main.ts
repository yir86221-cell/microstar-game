import { mount } from "./app.js";

const root = document.getElementById("root");
if (!root) throw new Error("找不到 #root 挂载点");

mount(root);
