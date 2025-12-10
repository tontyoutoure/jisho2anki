// ==UserScript==
// @name         Jisho2Anki - Step 2 (Data Extraction)
// @namespace    http://tampermonkey.net/
// @version      0.2
// @description  Inject buttons and extract data from Jisho.org
// @author       You
// @match        https://jisho.org/search/*
// @match        https://jisho.org/word/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // --- 配置 ---
    const BUTTON_SIZE = '24px';
    const ICON_COLOR = '#999';
    const ICON_HOVER_COLOR = '#555';

    // SVG 图标
    const UPLOAD_ICON = `<svg viewBox="0 0 24 24" width="${BUTTON_SIZE}" height="${BUTTON_SIZE}" stroke="${ICON_COLOR}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>`;
    const CONFIG_ICON = `<svg viewBox="0 0 24 24" width="${BUTTON_SIZE}" height="${BUTTON_SIZE}" stroke="${ICON_COLOR}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`;

    // --- 核心逻辑：数据提取 ---

    function extractJishoData() {
        const exactBlock = document.querySelector('.exact_block');
        if (!exactBlock) {
            console.error("未找到 Exact Block");
            return null;
        }

        // 1. 获取原始形式 (Expression)
        const textElement = exactBlock.querySelector('.concept_light-representation .text');
        const expression = textElement ? textElement.textContent.trim() : "";

        // 2. 获取完整读音 (Reading) - 难点
        // Jisho 的结构是：Furigana 里的 span 和 Text 里的节点是一一对应的
        // Furigana Span 有字 -> 它是汉字的读音
        // Furigana Span 为空 -> 它是假名（Okurigana），读音就是 Text 节点本身
        let reading = "";
        const furiganaElement = exactBlock.querySelector('.concept_light-representation .furigana');

        if (furiganaElement && textElement) {
            const fChildren = furiganaElement.children; // Furigana 下的 spans
            const tChildren = textElement.childNodes;   // Text 下的 nodes (包含纯文本和span)

            // 遍历所有部分进行拼接
            for (let i = 0; i < fChildren.length; i++) {
                const fText = fChildren[i].textContent.trim();
                const tText = tChildren[i].textContent.trim();

                if (fText) {
                    // 如果 Furigana 有内容，说明这是汉字，取注音 (例如 "おも")
                    reading += fText;
                } else {
                    // 如果 Furigana 是空的，说明这是假名，取原文 (例如 "い")
                    reading += tText;
                }
            }
        } else {
            // 如果没有注音栏（通常是纯假名单词），读音就是单词本身
            reading = expression;
        }

        // 3. 获取解释 (Meanings) 和 其他形式 (Other Forms)
        let meanings = [];
        let otherForms = [];

        // 找到包含所有解释的大容器
        const meaningsWrapper = exactBlock.querySelector('.meanings-wrapper');
        if (meaningsWrapper) {
            let currentCategory = 'definition'; // 状态机：默认在抓取定义

            // 遍历容器的直接子元素 (tags 和 wrapper)
            for (const child of meaningsWrapper.children) {
                if (child.classList.contains('meaning-tags')) {
                    // 遇到标签，检查是不是 "Other forms"
                    if (child.textContent.includes('Other forms')) {
                        currentCategory = 'otherForms';
                    } else {
                        currentCategory = 'definition';
                    }
                } else if (child.classList.contains('meaning-wrapper')) {
                    // 遇到内容块，根据当前状态提取
                    if (currentCategory === 'definition') {
                        const defText = child.querySelector('.meaning-meaning');
                        if (defText) {
                            // 移除 "1. " 这种序号 (可选，这里暂时保留纯文本)
                            meanings.push(defText.textContent.trim());
                        }
                    } else if (currentCategory === 'otherForms') {
                        // 提取其他形式
                         const formText = child.querySelector('.meaning-meaning');
                        if (formText) {
                            otherForms.push(formText.textContent.trim());
                        }
                    }
                }
            }
        }

        return {
            expression: expression,
            reading: reading,
            meanings: meanings,
            otherForms: otherForms
        };
    }

    // --- UI 构建函数 ---

    function createButton(htmlIcon, title, onClickHandler) {
        const btn = document.createElement('button');
        btn.innerHTML = htmlIcon;
        btn.title = title;
        btn.style.background = 'none';
        btn.style.border = 'none';
        btn.style.cursor = 'pointer';
        btn.style.padding = '0 5px';
        btn.style.transition = 'all 0.2s ease';

        btn.onmouseover = () => { btn.querySelector('svg').style.stroke = ICON_HOVER_COLOR; };
        btn.onmouseout = () => { btn.querySelector('svg').style.stroke = ICON_COLOR; };

        btn.addEventListener('click', (e) => {
            e.preventDefault();
            onClickHandler(e);
        });

        return btn;
    }

    function injectControls() {
        const exactBlock = document.querySelector('.exact_block');
        if (!exactBlock) return;

        // 防止重复注入 (如果页面动态加载)
        if (document.getElementById('jisho2anki-controls')) return;

        const container = document.createElement('div');
        container.id = 'jisho2anki-controls';
        container.style.display = 'inline-flex';
        container.style.alignItems = 'center';
        container.style.float = 'right';
        container.style.marginTop = '-5px';

        // 1. 上传按钮
        const uploadBtn = createButton(UPLOAD_ICON, "Upload to Anki", () => {
            console.log("--- 开始提取数据 ---");
            const data = extractJishoData();
            if (data) {
                console.log("原始形式:", data.expression);
                console.log("完整读音:", data.reading);
                console.log("解释:", data.meanings.join('; '));
                console.log("其他形式:", data.otherForms.join('; '));
                console.log("完整对象:", data);
            }
            console.log("--- 提取结束 ---");
        });

        // 2. 配置按钮
        const configBtn = createButton(CONFIG_ICON, "Configure AnkiConnect", () => {
            console.log("配置");
        });

        container.appendChild(uploadBtn);
        container.appendChild(configBtn);

        const header = exactBlock.querySelector('h4');
        if (header) {
            header.appendChild(container);
        } else {
            exactBlock.insertBefore(container, exactBlock.firstChild);
        }
    }

    // --- 执行入口 ---
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectControls);
    } else {
        injectControls();
    }

})();