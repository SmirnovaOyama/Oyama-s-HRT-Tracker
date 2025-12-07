# HRT Recorder Web

HRT Recorder Web（HRT 网页记录工具）

A privacy-focused, web-based tool for simulating and tracking estradiol levels during Hormone Replacement Therapy (HRT).<br>
这是一个注重隐私的网页工具，用于在激素替代疗法（HRT）期间模拟和追踪雌二醇水平。

## 🧠 Algorithm & Core Logic 算法逻辑

The pharmacokinetic algorithms, mathematical models, and parameters used in this simulation are derived directly from the **[HRT-Recorder-PKcomponent-Test](https://github.com/LaoZhong-Mihari/HRT-Recorder-PKcomponent-Test)** repository.<br>
本模拟中使用的药代动力学算法、数学模型与相关参数，直接来源于 **[HRT-Recorder-PKcomponent-Test](https://github.com/LaoZhong-Mihari/HRT-Recorder-PKcomponent-Test)** 仓库。

We strictly adhere to the `PKcore.swift` and `PKparameter.swift` logic provided by **@LaoZhong-Mihari**, ensuring that the web simulation matches the accuracy of the original native implementation (including 3-compartment models, two-part depot kinetics, and specific sublingual absorption tiers).<br>
我们严格遵循 **@LaoZhong-Mihari** 提供的 `PKcore.swift` 与 `PKparameter.swift` 中的逻辑，确保网页端模拟与原生实现在精度上保持一致（包括三室模型、双相肌注库房动力学以及特定的舌下吸收分层等）。

## 🚀 Features 功能

* **Multi-Route Simulation**: Supports Injection (Valerate, Benzoate, Cypionate, Enanthate), Oral, Sublingual, Gel, and Patches.<br>
  **多给药途径模拟**：支持注射（戊酸酯 Valerate、苯甲酸酯 Benzoate、环戊丙酸酯 Cypionate、庚酸酯 Enanthate）、口服、舌下、凝胶以及贴片等多种给药方式。

* **Real-time Visualization**: Interactive charts showing estimated estradiol concentration (pg/mL) over time.<br>
  **实时可视化**：通过交互式图表展示随时间变化的雌二醇估算浓度（pg/mL）。

* **Sublingual Guidance**: Detailed "Hold Time" and absorption parameter ($\theta$) guidance based on strict medical modeling.<br>
  **舌下服用指导**：基于严格的医学建模，提供详细的“含服时间（Hold Time）”与吸收参数（$\theta$）参考。

* **Privacy First**: All data is stored entirely in your browser's `localStorage`. No data is ever sent to a server.<br>
  **隐私优先**：所有数据都完全存储在你浏览器的 `localStorage` 中，绝不会发送到任何服务器。

* **Internationalization**: Native support for **Simplified Chinese** and **English**, **Cantonese**, **Russian, Ukrainian** and more.<br>
  **多语言支持**：原生支持多语言界面。

## 🧪 Run Locally 本地运行

This project is built with **React** and **TypeScript**. You can run it easily using a modern frontend tooling setup like [Vite](https://vitejs.dev/).<br>
本项目基于 **React** 与 **TypeScript** 构建，你可以使用诸如 [Vite](https://vitejs.dev/) 这样的现代前端工具链轻松运行它。

1. **Clone or Download** the files.<br>

   **Clone 或下载**项目文件到本地。

2. **Initialize a Vite project** (if starting from scratch):<br>
   **初始化一个 Vite 项目**（如果你是从零开始）：

   ```bash
   npm create vite@latest hrt-recorder -- --template react-ts
   cd hrt-recorder
   npm install
   ```

3. **Install Dependencies**:<br>
   **安装依赖**：

   ```bash
   npm install recharts lucide-react uuid @types/uuid clsx tailwind-merge
   ```

4. **Setup Tailwind CSS**:<br>
   **配置 Tailwind CSS**：

   Follow the [Tailwind CSS Vite Guide](https://tailwindcss.com/docs/guides/vite) to generate your `tailwind.config.js`.
   请按照 [Tailwind CSS 的 Vite 指南](https://tailwindcss.com/docs/guides/vite) 配置并生成你的 `tailwind.config.js` 文件。

5. **Add Code**:<br>
   **添加代码**：

   * Place `logic.ts` and `index.tsx` into your `src/` folder.<br>
     将 `logic.ts` 与 `index.tsx` 放入你的 `src/` 文件夹中。

   * Update `index.html` entry point if necessary.<br>
     如有需要，更新 `index.html` 中的入口配置。

6. **Run**:<br>
   **运行项目**：

   ```bash
   npm run dev
   ```

## 🌐 Deployment & Hosting 部署与托管

You are **very welcome** to deploy this application to your own personal website, blog, or server!<br>
我们**非常欢迎**你将此应用部署到自己的个人网站、博客或服务器上！

We want this tool to be accessible to everyone who needs it. You do not need explicit permission to host it.<br>
我们希望所有需要这款工具的人都能方便地使用它。你无需额外获得授权即可自行托管与部署。

**Attribution Requirement:**

If you deploy this app publicly, please:<br>
如果你将该应用公开部署，请：

1. **Keep the original algorithm credits**: Visibly link back to the [HRT-Recorder-PKcomponent-Test](https://github.com/LaoZhong-Mihari/HRT-Recorder-PKcomponent-Test) repository.<br>

   **保留原始算法的鸣谢信息**：在显眼位置添加指向 [HRT-Recorder-PKcomponent-Test](https://github.com/LaoZhong-Mihari/HRT-Recorder-PKcomponent-Test) 仓库的链接。

2. **Respect the license**: Ensure you follow any licensing terms associated with the original algorithm code.<br>
   **遵守许可协议**：确保你遵循原始算法代码所适用的全部许可条款。

*Happy Estimating!* 🏳️‍⚧️<br>
*祝你性转顺利、使用愉快！(๑•̀ㅂ•́)و✧* 🏳️‍⚧️<br>
祝所有用此webapp的停经期女性身体健康
