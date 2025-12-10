// ==UserScript==
// @name         Jisho2Anki - Step 2.9 (Separate Notes)
// @namespace    http://tampermonkey.net/
// @version      0.7
// @description  Extract Notes separately from Meanings
// @author       You
// @match        https://jisho.org/search/*
// @match        https://jisho.org/word/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // --- 配置 ---
    const BUTTON_SIZE = '20px';
    const ICON_COLOR = '#999';
    const ICON_HOVER_COLOR = '#555';

    // SVG 图标
    const UPLOAD_ICON = `<svg viewBox="0 0 24 24" width="${BUTTON_SIZE}" height="${BUTTON_SIZE}" stroke="${ICON_COLOR}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>`;
    const CONFIG_ICON = `<svg viewBox="0 0 24 24" width="${BUTTON_SIZE}" height="${BUTTON_SIZE}" stroke="${ICON_COLOR}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`;

    // --- 核心逻辑：提取单个词条数据 ---
    function extractJishoData(context) {
        if (!context) return null;

        // 1. 获取原始形式
        const textElement = context.querySelector('.concept_light-representation .text');
        const expression = textElement ? textElement.textContent.trim() : "";

        // 2. 获取完整读音
        let reading = "";
        const furiganaElement = context.querySelector('.concept_light-representation .furigana');

        if (furiganaElement && textElement) {
            const fChildren = furiganaElement.children;
            const tChildren = textElement.childNodes;
            const loopLen = Math.min(fChildren.length, tChildren.length);
            for (let i = 0; i < loopLen; i++) {
                const fText = fChildren[i].textContent.trim();
                const tText = tChildren[i].textContent.trim();
                reading += (fText ? fText : tText);
            }
        } else {
            reading = expression;
        }

        // 3. 获取详细解释 / Notes / Other forms
        let formattedMeanings = [];
        let otherForms = [];
        let notes = []; // 新增：独立的 Notes 数组

        const meaningsWrapper = context.querySelector('.meanings-wrapper');
        if (meaningsWrapper) {
            let currentPOS = "";

            for (const child of meaningsWrapper.children) {
                // --- 标签处理 ---
                if (child.classList.contains('meaning-tags')) {
                    const tagText = child.textContent.trim();
                    if (tagText === 'Notes') {
                        currentPOS = 'Notes'; // 标记进入 Notes 区域
                    } else if (tagText.includes('Other forms')) {
                        currentPOS = 'Other forms';
                    } else {
                        currentPOS = tagText;
                    }
                }
                // --- 内容块处理 ---
                else if (child.classList.contains('meaning-wrapper')) {

                    // Case A: Other Forms
                    if (currentPOS === 'Other forms') {
                        const formText = child.querySelector('.meaning-meaning');
                        if (formText) otherForms.push(formText.textContent.trim());
                    }

                    // Case B: Notes (新逻辑)
                    else if (currentPOS === 'Notes') {
                        const defSection = child.querySelector('.meaning-definition');
                        if (defSection) {
                            // 简单的文本清理
                            const clone = defSection.cloneNode(true);
                            // 移除可能存在的 "Read more"
                            const readMore = clone.querySelector('a');
                            if(readMore && readMore.textContent.includes('Read more')) readMore.remove();

                            notes.push(clone.textContent.trim());
                        }
                    }

                    // Case C: 普通释义 (Meanings)
                    else {
                        let entryString = "";
                        if (currentPOS) entryString += `${currentPOS}\n`;

                        const defSection = child.querySelector('.meaning-definition');
                        if (defSection) {
                            const readMoreLink = defSection.querySelector('a');
                            if (readMoreLink && readMoreLink.textContent.includes('Read more')) {
                                readMoreLink.remove();
                            }

                            const meaningTextElem = defSection.querySelector('.meaning-meaning');
                            let defText = "";

                            if (meaningTextElem) {
                                defText = meaningTextElem.textContent.trim();
                            } else {
                                const clone = defSection.cloneNode(true);
                                const divider = clone.querySelector('.meaning-definition-section_divider');
                                if (divider) divider.remove();
                                defText = clone.textContent.trim();
                            }

                            const defNumberElement = defSection.querySelector('.meaning-definition-section_divider');
                            const defNumber = defNumberElement ? defNumberElement.textContent.trim() + " " : "";

                            entryString += `${defNumber}${defText}`;
                        }

                        const sentenceDiv = child.querySelector('.sentence');
                        if (sentenceDiv) {
                            const japSentence = sentenceDiv.querySelector('.japanese');
                            const engSentence = sentenceDiv.querySelector('.english');

                            if (japSentence && engSentence) {
                                const jClone = japSentence.cloneNode(true);
                                const furiganas = jClone.querySelectorAll('.furigana');
                                furiganas.forEach(f => f.remove());

                                const jText = jClone.textContent.replace(/\s+/g, '').trim();
                                const eText = engSentence.textContent.trim();

                                entryString += `\n${jText}\n${eText}`;
                            }
                        }

                        if (entryString) formattedMeanings.push(entryString);
                    }
                }
            }
        }

        return {
            expression: expression,
            reading: reading,
            meanings: formattedMeanings,
            otherForms: otherForms,
            notes: notes // 返回独立的 notes
        };
    }

    // --- UI 构建函数 ---
    function createButton(htmlIcon, title, onClickHandler) {
        const btn = document.createElement('button');
        btn.innerHTML = htmlIcon;
        btn.title = title;
        btn.className = 'jisho2anki-btn';
        btn.style.background = 'none';
        btn.style.border = 'none';
        btn.style.cursor = 'pointer';
        btn.style.padding = '2px 5px';
        btn.style.transition = 'all 0.2s ease';
        btn.style.verticalAlign = 'middle';

        btn.onmouseover = () => { btn.querySelector('svg').style.stroke = ICON_HOVER_COLOR; };
        btn.onmouseout = () => { btn.querySelector('svg').style.stroke = ICON_COLOR; };

        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            onClickHandler(e);
        });

        return btn;
    }

    function injectControls() {
        const wordEntries = document.querySelectorAll('.concept_light');

        wordEntries.forEach(entry => {
            if (entry.querySelector('.jisho2anki-controls')) return;

            const container = document.createElement('div');
            container.className = 'jisho2anki-controls';
            container.style.display = 'inline-block';
            container.style.marginLeft = '10px';

            const uploadBtn = createButton(UPLOAD_ICON, "Upload this word to Anki", () => {
                console.log(`%c[Jisho2Anki] 正在提取: `, "color: green; font-weight: bold;");
                try {
                    const data = extractJishoData(entry);
                    if (data) {
                        console.log("--------------------------------");
                        console.log("【单词】", data.expression);
                        console.log("【读音】", data.reading);
                        console.log("【释义】\n", data.meanings.join('\n\n'));
                        console.log("【其他形式】", data.otherForms.join('; '));
                        console.log("【备注(Notes)】", data.notes.join('\n')); // 单独打印 Notes
                        console.log("--------------------------------");
                    }
                } catch (err) {
                    console.error("提取数据时出错:", err);
                }
            });

            const configBtn = createButton(CONFIG_ICON, "Configure AnkiConnect", () => {
                console.log("[Jisho2Anki] 点击了配置");
            });

            container.appendChild(uploadBtn);
            container.appendChild(configBtn);

            const statusDiv = entry.querySelector('.concept_light-status');
            if (statusDiv) {
                statusDiv.insertBefore(container, statusDiv.firstChild);
            } else {
                const wrapper = entry.querySelector('.concept_light-wrapper');
                if (wrapper) wrapper.appendChild(container);
            }
        });
    }

    const observer = new MutationObserver((mutations) => {
        injectControls();
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            injectControls();
            observer.observe(document.body, { childList: true, subtree: true });
        });
    } else {
        injectControls();
        observer.observe(document.body, { childList: true, subtree: true });
    }

})();