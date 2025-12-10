// ==UserScript==
// @name         Jisho2Anki - Step 3.1 (Multi-Mapping UI)
// @namespace    http://tampermonkey.net/
// @version      0.9
// @description  Add Scrollbar & Multi-Field Mapping support
// @author       You
// @match        https://jisho.org/search/*
// @match        https://jisho.org/word/*
// @grant        GM_xmlhttpRequest
// @connect      127.0.0.1
// @connect      localhost
// ==/UserScript==

(function() {
    'use strict';

    // --- Configuration Constants ---
    const STORAGE_KEY = 'jisho2anki_config';
    const DEFAULT_CONFIG = {
        ankiUrl: 'http://127.0.0.1:8765',
        deckName: 'Default',
        modelName: 'Basic',
        tags: 'jisho.org',
        fieldMapping: {} // Structure: { "ModelName": { "AnkiField": ["JishoKey1", "JishoKey2"] } }
    };

    // --- State Management ---
    let currentConfig = loadConfig();
    let availableDecks = [];
    let availableModels = [];
    let currentModelFields = [];

    // --- UI Constants ---
    const BUTTON_SIZE = '20px';
    const ICON_COLOR = '#999';
    const ICON_HOVER_COLOR = '#555';
    const UPLOAD_ICON = `<svg viewBox="0 0 24 24" width="${BUTTON_SIZE}" height="${BUTTON_SIZE}" stroke="${ICON_COLOR}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>`;
    const CONFIG_ICON = `<svg viewBox="0 0 24 24" width="${BUTTON_SIZE}" height="${BUTTON_SIZE}" stroke="${ICON_COLOR}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`;

    // --- AnkiConnect Helper Functions ---

    function ankiInvoke(action, params = {}) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: "POST",
                url: currentConfig.ankiUrl,
                data: JSON.stringify({ action, version: 6, params }),
                headers: { "Content-Type": "application/json" },
                onload: (response) => {
                    try {
                        const res = JSON.parse(response.responseText);
                        if (res.error) {
                            reject(res.error);
                        } else {
                            resolve(res.result);
                        }
                    } catch (e) {
                        reject("Failed to parse response");
                    }
                },
                onerror: (err) => {
                    reject("Network Error");
                }
            });
        });
    }

    async function checkConnection() {
        try {
            await ankiInvoke('version');
            return true;
        } catch (e) {
            return false;
        }
    }

    async function fetchAnkiData() {
        try {
            const [decks, models] = await Promise.all([
                ankiInvoke('deckNames'),
                ankiInvoke('modelNames')
            ]);
            availableDecks = decks || [];
            availableModels = models || [];
            return true;
        } catch (e) {
            console.error("Failed to fetch Anki data:", e);
            return false;
        }
    }

    async function fetchModelFields(modelName) {
        try {
            const fields = await ankiInvoke('modelFieldNames', { modelName });
            currentModelFields = fields || [];
            return currentModelFields;
        } catch (e) {
            console.error(`Failed to fetch fields for model ${modelName}:`, e);
            return [];
        }
    }

    // --- Local Storage Helpers ---
    function loadConfig() {
        const stored = localStorage.getItem(STORAGE_KEY);
        // Simple migration check: if old config format (string mapping), reset mapping or handle carefully.
        // For simplicity in this step, we assume fresh or compatible structure.
        return stored ? { ...DEFAULT_CONFIG, ...JSON.parse(stored) } : DEFAULT_CONFIG;
    }

    function saveConfig() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(currentConfig));
    }

    // --- Data Extraction Logic (Same as Step 3.0) ---
    function extractJishoData(context) {
        if (!context) return null;

        const textElement = context.querySelector('.concept_light-representation .text');
        const expression = textElement ? textElement.textContent.trim() : "";

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

        let formattedMeanings = [];
        let otherForms = [];
        let notes = [];

        const meaningsWrapper = context.querySelector('.meanings-wrapper');
        if (meaningsWrapper) {
            let currentPOS = "";

            for (const child of meaningsWrapper.children) {
                if (child.classList.contains('meaning-tags')) {
                    const tagText = child.textContent.trim();
                    if (tagText === 'Notes') currentPOS = 'Notes';
                    else if (tagText.includes('Other forms')) currentPOS = 'Other forms';
                    else currentPOS = tagText;
                }
                else if (child.classList.contains('meaning-wrapper')) {
                    if (currentPOS === 'Other forms') {
                        const formText = child.querySelector('.meaning-meaning');
                        if (formText) otherForms.push(formText.textContent.trim());
                    }
                    else if (currentPOS === 'Notes') {
                        const defSection = child.querySelector('.meaning-definition');
                        if (defSection) {
                            const clone = defSection.cloneNode(true);
                            const readMore = clone.querySelector('a');
                            if(readMore && readMore.textContent.includes('Read more')) readMore.remove();
                            notes.push(clone.textContent.trim());
                        }
                    }
                    else {
                        let entryString = "";
                        if (currentPOS) entryString += `[${currentPOS}] `;

                        const defSection = child.querySelector('.meaning-definition');
                        if (defSection) {
                            const readMoreLink = defSection.querySelector('a');
                            if (readMoreLink && readMoreLink.textContent.includes('Read more')) readMoreLink.remove();

                            const meaningTextElem = defSection.querySelector('.meaning-meaning');
                            let defText = meaningTextElem ? meaningTextElem.textContent.trim() : defSection.textContent.trim();
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
                                jClone.querySelectorAll('.furigana').forEach(f => f.remove());
                                entryString += `<br>ex: ${jClone.textContent.replace(/\s+/g, '').trim()} (${engSentence.textContent.trim()})`;
                            }
                        }
                        if (entryString) formattedMeanings.push(entryString);
                    }
                }
            }
        }

        return {
            expression,
            reading,
            meanings: formattedMeanings.join('<br>'),
            otherForms: otherForms.join('; '),
            notes: notes.join('<br>')
        };
    }

    // --- UI Helpers for Dynamic Mapping ---

    const JISHO_KEYS = ['expression', 'reading', 'meanings', 'otherForms', 'notes'];

    function createMappingSelect(selectedValue = "") {
        const sel = document.createElement('select');
        Object.assign(sel.style, {
            width: 'calc(100% - 30px)', padding: '5px', marginBottom: '5px', display: 'block'
        });

        // Default empty option
        const emptyOpt = document.createElement('option');
        emptyOpt.text = '-- Ignore --';
        emptyOpt.value = '';
        sel.appendChild(emptyOpt);

        JISHO_KEYS.forEach(key => {
            const opt = document.createElement('option');
            opt.value = key;
            opt.text = key;
            if (selectedValue === key) opt.selected = true;
            sel.appendChild(opt);
        });
        return sel;
    }

    function createMappingRow(ankiField, initialValues = []) {
        const container = document.createElement('div');
        container.style.marginBottom = '10px';
        container.style.borderBottom = '1px dashed #eee';
        container.style.paddingBottom = '5px';
        container.dataset.ankiField = ankiField; // Helper for saving

        // Label
        const label = document.createElement('div');
        label.textContent = ankiField;
        label.style.fontWeight = 'bold';
        label.style.fontSize = '0.9em';
        label.style.marginBottom = '3px';
        container.appendChild(label);

        // Inputs Container
        const inputsDiv = document.createElement('div');
        container.appendChild(inputsDiv);

        // Add Initial Selects
        if (!initialValues || initialValues.length === 0) {
            inputsDiv.appendChild(createMappingSelect()); // One empty by default
        } else {
            // Ensure initialValues is an array (handle legacy string config if any)
            const values = Array.isArray(initialValues) ? initialValues : [initialValues];
            values.forEach(val => {
                inputsDiv.appendChild(createMappingSelect(val));
            });
        }

        // Add [+] Button
        const addBtn = document.createElement('button');
        addBtn.textContent = '+';
        Object.assign(addBtn.style, {
            width: '24px', height: '24px', cursor: 'pointer',
            backgroundColor: '#eee', border: '1px solid #ccc', borderRadius: '4px',
            marginLeft: '5px'
        });
        addBtn.title = "Add another source field for this Anki field";

        addBtn.onclick = () => {
            const newSelect = createMappingSelect();
            // Add a remove button for added selects? For simplicity, we just append now.
            // Improved UX: Insert before the button, but we placed button outside inputsDiv?
            // Let's place the button at the bottom of the input list
            inputsDiv.appendChild(newSelect);
        };

        container.appendChild(addBtn);

        return container;
    }


    // --- Modal UI Construction ---

    function createModal() {
        if (document.getElementById('jisho2anki-modal')) return;

        const modalOverlay = document.createElement('div');
        modalOverlay.id = 'jisho2anki-modal';
        Object.assign(modalOverlay.style, {
            position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
            backgroundColor: 'rgba(0,0,0,0.5)', zIndex: '10000', display: 'flex',
            justifyContent: 'center', alignItems: 'center'
        });

        const modalContent = document.createElement('div');
        Object.assign(modalContent.style, {
            backgroundColor: 'white', padding: '20px', borderRadius: '8px',
            width: '500px', maxWidth: '90%', maxHeight: '90vh', // Limit height
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
            fontFamily: 'sans-serif', fontSize: '14px',
            display: 'flex', flexDirection: 'column' // Flex layout for scrolling content
        });

        // Header
        const header = document.createElement('h2');
        header.textContent = 'Jisho2Anki Configuration';
        header.style.marginTop = '0';
        header.style.borderBottom = '1px solid #eee';
        header.style.paddingBottom = '10px';
        header.style.flexShrink = '0'; // Header doesn't shrink

        // Scrollable Content Wrapper
        const scrollableContent = document.createElement('div');
        Object.assign(scrollableContent.style, {
            overflowY: 'auto', paddingRight: '5px', flexGrow: '1'
        });

        // --- URL Input ---
        const urlGroup = createInputGroup('AnkiConnect URL:', 'text', currentConfig.ankiUrl);
        const urlInput = urlGroup.querySelector('input');
        const statusSpan = document.createElement('span');
        statusSpan.style.marginLeft = '10px';
        statusSpan.style.fontWeight = 'bold';
        urlGroup.appendChild(statusSpan);

        // --- Connection Logic ---
        const updateStatus = (isConnected, msg) => {
            statusSpan.textContent = msg;
            statusSpan.style.color = isConnected ? 'green' : 'red';
            deckSelect.disabled = !isConnected;
            modelSelect.disabled = !isConnected;
            if(isConnected) refreshDropdowns();
        };

        const tryConnect = async () => {
            statusSpan.textContent = 'Checking...';
            statusSpan.style.color = 'orange';
            currentConfig.ankiUrl = urlInput.value;
            const connected = await checkConnection();
            if (connected) {
                const dataFetched = await fetchAnkiData();
                if (dataFetched) {
                    updateStatus(true, 'Connected!');
                } else {
                    updateStatus(false, 'Connected, but failed to fetch data.');
                }
            } else {
                updateStatus(false, 'Connection Failed');
            }
        };

        urlInput.addEventListener('blur', tryConnect);

        // --- Dropdowns ---
        const deckGroup = createSelectGroup('Target Deck:', 'Loading...');
        const deckSelect = deckGroup.querySelector('select');
        deckSelect.disabled = true;

        const modelGroup = createSelectGroup('Note Type (Model):', 'Loading...');
        const modelSelect = modelGroup.querySelector('select');
        modelSelect.disabled = true;

        // --- Tags ---
        const tagGroup = createInputGroup('Tags (space separated):', 'text', currentConfig.tags);
        const tagInput = tagGroup.querySelector('input');

        // --- Field Mapping Container (Updated Step 3.1) ---
        const mappingContainer = document.createElement('div');
        Object.assign(mappingContainer.style, {
            marginTop: '15px', padding: '10px', backgroundColor: '#f9f9f9',
            border: '1px solid #eee',
            maxHeight: '300px', // Scrollbar Limit
            overflowY: 'auto'   // Scrollbar Enable
        });
        mappingContainer.innerHTML = '<strong>Field Mapping</strong><br><small style="color:#666">Select a Model first to map fields.</small>';


        // --- Refresh Logic ---
        const refreshDropdowns = () => {
            deckSelect.innerHTML = '';
            availableDecks.forEach(d => {
                const opt = document.createElement('option');
                opt.value = d;
                opt.textContent = d;
                if(d === currentConfig.deckName) opt.selected = true;
                deckSelect.appendChild(opt);
            });

            modelSelect.innerHTML = '';
            availableModels.forEach(m => {
                const opt = document.createElement('option');
                opt.value = m;
                opt.textContent = m;
                if(m === currentConfig.modelName) opt.selected = true;
                modelSelect.appendChild(opt);
            });

            if(modelSelect.value) generateMappingInputs(modelSelect.value);
        };

        const generateMappingInputs = async (modelName) => {
            mappingContainer.innerHTML = 'Loading fields...';
            const fields = await fetchModelFields(modelName);
            mappingContainer.innerHTML = `<strong>Mapping for: ${modelName}</strong><br><small>Click [+] to map multiple sources to one field.</small><hr style="margin:5px 0 10px 0; border:0; border-top:1px solid #ddd;">`;

            if(fields.length === 0) {
                 mappingContainer.innerHTML += '<span style="color:red">No fields found.</span>';
                 return;
            }

            // Get existing config for this model
            const savedMapping = currentConfig.fieldMapping[modelName] || {};

            fields.forEach(field => {
                // savedMapping[field] might be a string (old) or array (new) or undefined
                const row = createMappingRow(field, savedMapping[field]);
                mappingContainer.appendChild(row);
            });
        };

        modelSelect.addEventListener('change', (e) => {
            generateMappingInputs(e.target.value);
        });

        // --- Footer Buttons ---
        const footer = document.createElement('div');
        Object.assign(footer.style, { marginTop: '20px', textAlign: 'right', flexShrink: '0', paddingTop: '10px', borderTop: '1px solid #eee' });

        const saveBtn = document.createElement('button');
        saveBtn.textContent = 'Save & Close';
        Object.assign(saveBtn.style, {
            padding: '8px 16px', backgroundColor: '#47DB27', color: 'white',
            border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold'
        });

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        Object.assign(cancelBtn.style, {
            padding: '8px 16px', backgroundColor: '#ccc', color: 'white',
            border: 'none', borderRadius: '4px', cursor: 'pointer', marginRight: '10px'
        });

        saveBtn.onclick = () => {
            // Harvest Data
            currentConfig.ankiUrl = urlInput.value;
            currentConfig.deckName = deckSelect.value;
            currentConfig.modelName = modelSelect.value;
            currentConfig.tags = tagInput.value;

            // Harvest Mappings (Multi-select support)
            if (modelSelect.value) {
                if (!currentConfig.fieldMapping) currentConfig.fieldMapping = {};
                const newModelMapping = {};

                // Find all mapping rows
                const rows = mappingContainer.querySelectorAll('div[data-anki-field]');
                rows.forEach(row => {
                    const ankiField = row.dataset.ankiField;
                    const selects = row.querySelectorAll('select');
                    const values = [];
                    selects.forEach(s => {
                        if (s.value) values.push(s.value);
                    });

                    // Save as array if it has values, else undefined/empty
                    if (values.length > 0) {
                        newModelMapping[ankiField] = values;
                    }
                });

                currentConfig.fieldMapping[modelSelect.value] = newModelMapping;
            }

            saveConfig();
            document.body.removeChild(modalOverlay);
        };

        cancelBtn.onclick = () => {
            document.body.removeChild(modalOverlay);
        };

        footer.appendChild(cancelBtn);
        footer.appendChild(saveBtn);

        // Assembly
        scrollableContent.appendChild(urlGroup);
        scrollableContent.appendChild(deckGroup);
        scrollableContent.appendChild(modelGroup);
        scrollableContent.appendChild(tagGroup);
        scrollableContent.appendChild(mappingContainer);

        modalContent.appendChild(header);
        modalContent.appendChild(scrollableContent);
        modalContent.appendChild(footer);

        modalOverlay.appendChild(modalContent);
        document.body.appendChild(modalOverlay);

        tryConnect();
    }

    function createInputGroup(labelText, type, value) {
        const div = document.createElement('div');
        div.style.marginBottom = '10px';
        const label = document.createElement('label');
        label.textContent = labelText;
        label.style.display = 'block';
        label.style.marginBottom = '5px';
        label.style.fontWeight = 'bold';

        const input = document.createElement('input');
        input.type = type;
        input.value = value;
        input.style.width = '100%';
        input.style.padding = '5px';
        input.style.boxSizing = 'border-box';

        div.appendChild(label);
        div.appendChild(input);
        return div;
    }

    function createSelectGroup(labelText, placeholder) {
        const div = document.createElement('div');
        div.style.marginBottom = '10px';
        const label = document.createElement('label');
        label.textContent = labelText;
        label.style.display = 'block';
        label.style.marginBottom = '5px';
        label.style.fontWeight = 'bold';

        const select = document.createElement('select');
        select.style.width = '100%';
        select.style.padding = '5px';

        const opt = document.createElement('option');
        opt.textContent = placeholder;
        select.appendChild(opt);

        div.appendChild(label);
        div.appendChild(select);
        return div;
    }

    // --- Main UI Integration ---

    function createButton(htmlIcon, title, onClickHandler) {
        const btn = document.createElement('button');
        btn.innerHTML = htmlIcon;
        btn.title = title;
        btn.className = 'jisho2anki-btn';
        Object.assign(btn.style, {
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '2px 5px', transition: 'all 0.2s ease', verticalAlign: 'middle'
        });

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
            Object.assign(container.style, {
                display: 'inline-block', marginLeft: '10px'
            });

            const uploadBtn = createButton(UPLOAD_ICON, "Upload this word to Anki", () => {
                const data = extractJishoData(entry);
                if (data) {
                    console.log("[Jisho2Anki] Extracted Data:", data);
                    alert(`Data ready. Check Console for details. (Config allows mapping ${currentConfig.modelName})`);
                }
            });

            const configBtn = createButton(CONFIG_ICON, "Configure AnkiConnect", () => {
                createModal();
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

    // --- Initialization ---
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