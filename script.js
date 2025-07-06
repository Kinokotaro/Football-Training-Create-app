document.addEventListener('DOMContentLoaded', () => {
    const {
        jsPDF
    } = window.jspdf;
    const canvas = new fabric.Canvas('canvas', { selection: true });
    const sessionList = document.getElementById('session-list');
    const editorArea = document.getElementById('editor-area');
    const welcomeMessage = document.getElementById('welcome-message');
    const planDateInput = document.getElementById('plan-date');
    const objectColorPicker = document.getElementById('object-color-picker'); 

    let allSessions = [];
    let currentSessionId = null;
    const soccerFieldUrl = 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b9/Soccer_field_-_empty.svg/2000px-Soccer_field_-_empty.svg.png';

    let clipboard = null; // For copy/paste functionality
    let isLineDrawingMode = false; // Flag for line drawing mode
    let line = null; // Current line being drawn

    // --- Canvas Setup --- //
    const setCanvasBackground = () => {
        canvas.setBackgroundImage(soccerFieldUrl, canvas.renderAll.bind(canvas), {
            originX: 'left',
            originY: 'top',
            crossOrigin: 'anonymous',
            scaleX: canvas.width / 2000,
            scaleY: canvas.width / 2000, // Maintain aspect ratio
        });
    };

    const resizeCanvas = () => {
        if (!editorArea.classList.contains('d-none')) {
            const container = document.querySelector('.canvas-container');
            const width = container.offsetWidth;
            const height = width * 0.7; // Maintain aspect ratio
            container.style.height = `${height}px`;
            canvas.setWidth(width).setHeight(height);
            setCanvasBackground();
        }
    };
    window.addEventListener('resize', resizeCanvas);
    new ResizeObserver(resizeCanvas).observe(document.querySelector('.canvas-container'));

    // --- Data Handling --- //
    const saveAllSessions = () => localStorage.setItem('trainingSessions', JSON.stringify(allSessions));
    const loadAllSessions = () => {
        const data = localStorage.getItem('trainingSessions');
        allSessions = data ? JSON.parse(data) : [];
    };
    const getCurrentSession = () => allSessions.find(s => s.id === currentSessionId);
    const getTodaySessions = () => allSessions.filter(s => s.date === planDateInput.value).sort((a, b) => a.id - b.id);

    // --- UI Rendering --- //
    const renderSessionList = () => {
        sessionList.innerHTML = '';
        const todaySessions = getTodaySessions();
        todaySessions.forEach(session => {
            const item = document.createElement('a');
            item.href = '#';
            item.className = `list-group-item list-group-item-action ${session.id === currentSessionId ? 'active' : ''}`;
            item.dataset.id = session.id;

            const nameSpan = document.createElement('span');
            nameSpan.textContent = session.name || '無題のセッション';
            item.appendChild(nameSpan);

            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'session-actions';
            actionsDiv.innerHTML = `
                <button class="btn btn-outline-secondary btn-sm" data-action="duplicate" title="複製"><i class="bi bi-copy"></i></button>
                <button class="btn btn-outline-danger btn-sm" data-action="delete" title="削除"><i class="bi bi-trash"></i></button>
            `;
            item.appendChild(actionsDiv);

            item.addEventListener('click', (e) => {
                if (e.target.closest('button')) return;
                e.preventDefault();
                selectSession(session.id);
            });
            sessionList.appendChild(item);
        });
    };

    const renderEditor = () => {
        const session = getCurrentSession();
        if (session) {
            welcomeMessage.classList.add('d-none');
            editorArea.classList.remove('d-none');
            editorArea.classList.add('d-flex');
            document.getElementById('training-name-new').value = session.name;
            document.getElementById('training-time-new').value = session.time;
            document.getElementById('training-objective-new').value = session.objective;
            document.getElementById('training-description-new').value = session.description || ''; // New field
            canvas.loadFromJSON(session.canvasData, () => {
                canvas.renderAll();
                resizeCanvas();
            });
        } else {
            welcomeMessage.classList.remove('d-none');
            editorArea.classList.add('d-none');
            editorArea.classList.remove('d-flex');
        }
    };

    

    // --- Event Handlers & Actions --- //
    const selectSession = (id) => {
        currentSessionId = id;
        renderSessionList();
        renderEditor();
    };

    const addSession = () => {
        const newSession = {
            id: Date.now(),
            date: planDateInput.value,
            name: '新しいセッション',
            time: '15分',
            objective: '',
            description: '', // New field
            canvasData: null
        };
        allSessions.push(newSession);
        saveAllSessions();
        selectSession(newSession.id);
        renderSessionList(); // Add this line
    };

    const updateCurrentSessionData = () => {
        const sessionIndex = allSessions.findIndex(s => s.id === currentSessionId);
        if (sessionIndex !== -1) {
            const session = allSessions[sessionIndex];
            session.name = document.getElementById('training-name-new').value;
            session.time = document.getElementById('training-time-new').value;
            session.objective = document.getElementById('training-objective-new').value;
            session.description = document.getElementById('training-description-new').value; // New field
            session.canvasData = canvas.toJSON();
            session.previewImage = canvas.toDataURL({ format: 'png', multiplier: 1 }); // Generate image data
            saveAllSessions();
        } else {
            console.warn('updateCurrentSessionData: Session not found for currentSessionId', currentSessionId);
        }
    };

    const handleDateChange = () => {
        currentSessionId = null;
        renderSessionList();
        renderEditor();
    };

    const handleSessionAction = (e) => {
        const button = e.target.closest('button');
        if (!button) return;
        const action = button.dataset.action;
        const sessionId = parseInt(button.closest('.list-group-item').dataset.id, 10);

        if (action === 'delete') {
            if (confirm('このセッションを本当に削除しますか？')) {
                allSessions = allSessions.filter(s => s.id !== sessionId);
                if (currentSessionId === sessionId) currentSessionId = null;
                saveAllSessions();
                handleDateChange();
                renderSessionList(); // Add this line
            }
        } else if (action === 'duplicate') {
            const originalSession = allSessions.find(s => s.id === sessionId);
            const newSession = {
                ...JSON.parse(JSON.stringify(originalSession)),
                id: Date.now(),
                name: `${originalSession.name} (コピー)`,
            };
            allSessions.push(newSession);
            saveAllSessions();
            selectSession(newSession.id);
            renderSessionList(); // Add this line
        }
    };

    const exportToPdf = async () => {
        console.log("Export to PDF initiated.");
        const todaySessions = getTodaySessions();
        if (todaySessions.length === 0) {
            alert('PDFに出力するセッションがありません。');
            console.log("No sessions to export.");
            return;
        }

        const doc = new jsPDF();
        // 日本語フォントの追加を一時的にコメントアウト
        // doc.addFont('https://cdnjs.cloudflare.com/ajax/libs/yakuhanjp/3.4.1/fonts/YakuHanJP/YakuHanJP-Regular.ttf', 'YakuHanJP', 'normal');
        // doc.setFont('YakuHanJP');

        doc.text(`トレーニングプラン: ${planDateInput.value}`, 14, 20);

        let yPos = 30;
        const pageHeight = doc.internal.pageSize.height;
        const margin = 14;

        for (let i = 0; i < todaySessions.length; i++) {
            const session = todaySessions[i];

            try {
                console.log(`Processing session ${session.id}: ${session.name}`);
                // テキスト情報の描画
                doc.setFontSize(14);
                doc.text(`${i + 1}. ${session.name || '無題のセッション'} (${session.time || '時間未定'})`, margin, yPos);
                yPos += 8;

                doc.setFontSize(10);
                doc.text(`狙い: ${session.objective || '未設定'}`, margin, yPos, { maxWidth: 180 });
                yPos += 15;

                // 作図の画像化と描画
                const tempCanvas = new fabric.StaticCanvas(null, { width: 800, height: 520 });
                console.log("Loading background image for tempCanvas...");
                await new Promise((resolve, reject) => {
                    tempCanvas.setBackgroundImage(soccerFieldUrl, tempCanvas.renderAll.bind(tempCanvas), {
                        originX: 'left',
                        originY: 'top',
                        crossOrigin: 'anonymous',
                        scaleX: tempCanvas.width / 2000,
                        scaleY: tempCanvas.height / 1300,
                    }, () => {
                        console.log("Background image loaded. Loading canvas data...");
                        tempCanvas.loadFromJSON(session.canvasData, () => {
                            tempCanvas.renderAll();
                            resolve();
                        });
                    });
                });

                // 画像の解像度を上げてエクスポート
                const imgData = tempCanvas.toDataURL({ format: 'png', multiplier: 2 }); // multiplierで解像度を2倍に
                console.log("Generated image data length:", imgData.length); // Debugging

                const imgWidth = 180; // PDF上での画像幅 (mm)
                const imgHeight = tempCanvas.height * imgWidth / tempCanvas.width; // アスペクト比を維持

                // ページ送りの処理
                if (yPos + imgHeight > pageHeight - margin) {
                    doc.addPage();
                    yPos = margin;
                }

                console.log("Adding image to PDF...");
                doc.addImage(imgData, 'PNG', margin, yPos, imgWidth, imgHeight);
                yPos += imgHeight + 10; // 画像の下に余白を追加

            } catch (error) {
                console.error(`Error exporting session ${session.id}:`, error);
                alert(`セッション ${session.name} のエクスポート中にエラーが発生しました。コンソールを確認してください。`);
                // Continue to next session or break
            }
        }

        console.log("Saving PDF...");
        doc.save(`training_plan_${planDateInput.value}.pdf`);
        console.log("PDF save initiated.");
    };

    // --- Object Creation (Canvas) --- //
    const addPlayer = (color) => {
        const playerBody = new fabric.Circle({
            radius: 10, // 15 * 2/3 = 10
            fill: color || 'blue',
            originX: 'center',
            originY: 'center'
        });

        // Left arm (curved path relative to group center)
        const leftArm = new fabric.Path('M -10 0 Q -16 -10 -10 -20', { // Adjusted coordinates
            stroke: color || 'blue',
            strokeWidth: 2, // Adjusted stroke width
            fill: '',
            originX: 'center',
            originY: 'center'
        });

        // Right arm (curved path relative to group center)
        const rightArm = new fabric.Path('M 10 0 Q 16 -10 10 -20', { // Adjusted coordinates
            stroke: color || 'blue',
            strokeWidth: 2, // Adjusted stroke width
            fill: '',
            originX: 'center',
            originY: 'center'
        });

        const playerGroup = new fabric.Group([playerBody, leftArm, rightArm], {
            left: 50,
            top: 50,
            originX: 'center',
            originY: 'center'
        });
        canvas.add(playerGroup);
    };

    const addBall = () => {
        const ball = new fabric.Circle({
            radius: 5, // 8 * 2/3 = 5.33 -> 5
            fill: 'white',
            stroke: 'black',
            strokeWidth: 1,
            left: 100,
            top: 50,
            originX: 'center',
            originY: 'center'
        });
        canvas.add(ball);
    };

    const addCone = (color) => canvas.add(new fabric.Triangle({ width: 13.33, height: 20, fill: color || 'orange', left: 150, top: 50, originX: 'center', originY: 'center' })); // width: 20 * 2/3 = 13.33, height: 30 * 2/3 = 20
    const addMarker = (color) => {
        const coneHeight = 30; // Base cone height for calculation
        const coneWidth = 20;   // Base cone width for calculation
        const markerHeight = (coneHeight / 4) * (2/3); // 7.5 * 2/3 = 5
        const markerWidth = (coneWidth * 2 / 3) * (2/3); // 13.33 * 2/3 = 8.88

        const marker = new fabric.Triangle({
            width: markerWidth,
            height: markerHeight,
            fill: color || 'yellow',
            left: 200,
            top: 50,
            originX: 'center',
            originY: 'center'
        });
        canvas.add(marker);
    };

    const addGoal = () => canvas.add(new fabric.Rect({ width: 66.66, height: 13.33, fill: 'white', stroke: 'black', strokeWidth: 2, left: 250, top: 50, originX: 'center', originY: 'center' })); // width: 100 * 2/3 = 66.66, height: 20 * 2/3 = 13.33
    
    // --- Line Drawing Functions --- //
    const handleLineMouseDown = (o) => {
        if (!isLineDrawingMode) return; // Only proceed if in line drawing mode

        const pointer = canvas.getPointer(o.e);
        if (!line) {
            // First click: start drawing a new line
            const points = [pointer.x, pointer.y, pointer.x, pointer.y];
            line = new fabric.Line(points, {
                strokeWidth: 2,
                fill: objectColorPicker.value || 'black',
                stroke: objectColorPicker.value || 'black',
                originX: 'center',
                originY: 'center',
                selectable: true,
                evented: true,
            });
            canvas.add(line);
        } else {
            // Second click: finish the current line
            line.setCoords();
            disableLineDrawingMode(); // Exit line drawing mode
            updateCurrentSessionData(); // Save after drawing line
        }
    };

    const handleLineMouseMove = (o) => {
        if (!isLineDrawingMode || !line) return;
        const pointer = canvas.getPointer(o.e);
        line.set({
            x2: pointer.x,
            y2: pointer.y
        });
        canvas.renderAll();
    };

    const disableLineDrawingMode = () => {
        isLineDrawingMode = false;
        line = null;
        canvas.selection = true; // Re-enable object selection
        canvas.defaultCursor = 'default';
        canvas.hoverCursor = 'move';
    };

    const addLine = () => {
        if (isLineDrawingMode) {
            // If already in line drawing mode, disable it
            disableLineDrawingMode();
        } else {
            // Enter line drawing mode
            isLineDrawingMode = true;
            canvas.selection = false; // Disable object selection temporarily
            canvas.defaultCursor = 'crosshair';
            canvas.hoverCursor = 'crosshair';
            canvas.discardActiveObject(); // Deselect any active objects
        }
    };

    const addArea = () => {
        disableLineDrawingMode();
        const rect = new fabric.Rect({
            left: 50,
            top: 50,
            width: 100,
            height: 50,
            fill: 'rgba(0,0,255,0.3)', // Semi-transparent blue
            stroke: 'white',
            strokeWidth: 2,
            originX: 'left',
            originY: 'center'
        });
        canvas.add(rect);
        updateCurrentSessionData();
    };

    const addText = (color) => {
        disableLineDrawingMode();
        const text = new fabric.IText('テキスト', {
            left: 50,
            top: 50,
            fontFamily: 'sans-serif',
            fontSize: 20,
            fill: color || 'black',
            editable: true
        });
        canvas.add(text);
        updateCurrentSessionData();
    };

    const deleteSelected = () => {
        canvas.getActiveObjects().forEach(obj => canvas.remove(obj));
        canvas.discardActiveObject().renderAll();
        updateCurrentSessionData(); // Update data after deletion
    }

    // --- Keyboard Shortcuts --- //
    window.addEventListener('keydown', (e) => {
        // Allow normal text input in form fields
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.contentEditable === 'true') {
            return; // Do not interfere with form input
        }

        if (!currentSessionId) return; // Only active when a session is selected

        // Delete/Backspace for canvas objects
        if (e.key === 'Backspace' || e.key === 'Delete') {
            const activeObject = canvas.getActiveObject();
            const activeGroup = canvas.getActiveObjects(); // For multiple selection

            if (activeObject || (activeGroup && activeGroup.length > 0)) {
                e.preventDefault(); // Prevent browser back navigation or text deletion
                deleteSelected();
            }
        }

        // Copy (Ctrl+C or Cmd+C)
        if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
            const activeObject = canvas.getActiveObject();
            if (activeObject) {
                activeObject.clone(function(clonedObj) {
                    clipboard = clonedObj;
                });
            }
        }

        // Paste (Ctrl+V or Cmd+V)
        if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
            if (clipboard) {
                clipboard.clone(function(clonedObj) {
                    canvas.discardActiveObject();
                    clonedObj.set({
                        left: clonedObj.left + 10,
                        top: clonedObj.top + 10,
                        evented: true,
                    });
                    if (clonedObj.type === 'activeSelection') {
                        // active selection needs a reference to the canvas to render its controls
                        clonedObj.canvas = canvas;
                        canvas.add(clonedObj);
                        clonedObj.forEachObject(function(obj) {
                            canvas.add(obj);
                        });
                        clonedObj.setCoords();
                    } else {
                        canvas.add(clonedObj);
                    }
                    clipboard.top += 10;
                    clipboard.left += 10;
                    canvas.setActiveObject(clonedObj);
                    canvas.requestRenderAll();
                    updateCurrentSessionData(); // Update data after pasting
                });
            }
        }
    });

    // --- Event Listeners --- //
    planDateInput.addEventListener('change', handleDateChange);
    document.getElementById('add-session').addEventListener('click', addSession);
    sessionList.addEventListener('click', handleSessionAction);
    
    canvas.on('object:modified', updateCurrentSessionData);
    canvas.on('object:added', updateCurrentSessionData);
    canvas.on('object:removed', updateCurrentSessionData);

    

    

    // Canvas mouse events for line drawing (always active, logic inside checks isLineDrawingMode)
    canvas.on('mouse:down', (o) => {
        if (isLineDrawingMode) {
            handleLineMouseDown(o);
        }
    });
    canvas.on('mouse:move', (o) => {
        if (isLineDrawingMode) {
            handleLineMouseMove(o);
        }
    });
    canvas.on('mouse:up', (o) => {
        if (isLineDrawingMode && line) {
            line.setCoords();
            disableLineDrawingMode();
            updateCurrentSessionData();
        }
    });

    document.getElementById('view-daily-preview').addEventListener('click', (e) => {
        e.preventDefault();
        const selectedDate = planDateInput.value;
        window.open(`preview.html?date=${selectedDate}`, '_blank');
    });
    document.getElementById('add-player').addEventListener('click', () => { disableLineDrawingMode(); addPlayer(objectColorPicker.value); });
    document.getElementById('add-ball').addEventListener('click', () => { disableLineDrawingMode(); addBall(); });
    document.getElementById('add-cone').addEventListener('click', () => { disableLineDrawingMode(); addCone(objectColorPicker.value); });
    document.getElementById('add-marker').addEventListener('click', () => { disableLineDrawingMode(); addMarker(objectColorPicker.value); });
    document.getElementById('add-goal').addEventListener('click', () => { disableLineDrawingMode(); addGoal(); });
    document.getElementById('add-line').addEventListener('click', addLine); // addLine now toggles mode

    const trainingNameInput = document.getElementById('training-name-new');
    if (trainingNameInput) {
        trainingNameInput.addEventListener('input', (e) => {
            console.log('training-name-new input event: value =', e.target.value);
        });
        trainingNameInput.addEventListener('keydown', (e) => {
            console.log('training-name-new keydown event: key =', e.key, 'value =', e.target.value);
        });
    }

    const trainingTimeInput = document.getElementById('training-time-new');
    if (trainingTimeInput) {
        trainingTimeInput.addEventListener('input', (e) => {
            console.log('training-time-new input event: value =', e.target.value);
        });
        trainingTimeInput.addEventListener('keydown', (e) => {
            console.log('training-time-new keydown event: key =', e.key, 'value =', e.target.value);
        });
    }

    const trainingObjectiveInput = document.getElementById('training-objective-new');
    if (trainingObjectiveInput) {
        trainingObjectiveInput.addEventListener('input', (e) => {
            console.log('training-objective-new input event: value =', e.target.value);
        });
        trainingObjectiveInput.addEventListener('keydown', (e) => {
            console.log('training-objective-new keydown event: key =', e.key, 'value =', e.target.value);
        });
    }

    const trainingDescriptionInput = document.getElementById('training-description-new');
    if (trainingDescriptionInput) {
        trainingDescriptionInput.addEventListener('input', (e) => {
            console.log('training-description-new input event: value =', e.target.value);
        });
        trainingDescriptionInput.addEventListener('keydown', (e) => {
            console.log('training-description-new keydown event: key =', e.key, 'value =', e.target.value);
        });
    }
    document.getElementById('add-area').addEventListener('click', () => { disableLineDrawingMode(); addArea(); });
    document.getElementById('add-text').addEventListener('click', () => { disableLineDrawingMode(); addText(objectColorPicker.value); });

    document.getElementById('view-daily-preview').addEventListener('click', (e) => {
        e.preventDefault();
        const selectedDate = planDateInput.value;
        window.open(`preview.html?date=${selectedDate}`, '_blank');
    });

    document.getElementById('delete-selected').addEventListener('click', deleteSelected);
    document.getElementById('save-session').addEventListener('click', updateCurrentSessionData);
    

    // Color picker event listener
    objectColorPicker.addEventListener('input', () => {
        const activeObject = canvas.getActiveObject();
        if (activeObject) {
            if (activeObject.type === 'group') { // Player is a group
                activeObject.forEachObject(obj => {
                    if (obj.type === 'circle' || obj.type === 'path') { // Body and arms
                        obj.set('fill', objectColorPicker.value);
                        obj.set('stroke', objectColorPicker.value);
                    }
                });
            } else if (activeObject.type === 'triangle' || activeObject.type === 'rect' || activeObject.type === 'i-text' || activeObject.type === 'line') {
                activeObject.set('fill', objectColorPicker.value);
                activeObject.set('stroke', objectColorPicker.value);
            }
            canvas.renderAll();
            updateCurrentSessionData();
        }
    });

    // Update color picker when object is selected
    canvas.on('selection:created', (e) => {
        const activeObject = canvas.getActiveObject();
        if (activeObject) {
            let color = '#000000'; // Default to black
            if (activeObject.type === 'group') { // Player
                const playerBody = activeObject.getObjects('circle')[0];
                if (playerBody) color = playerBody.fill;
            } else if (activeObject.fill) {
                color = activeObject.fill;
            }
            // For lines, stroke is the color
            if (activeObject.stroke) {
                color = activeObject.stroke;
            }
            objectColorPicker.value = color;
        }
    });

    canvas.on('selection:updated', (e) => {
        const activeObject = canvas.getActiveObject();
        if (activeObject) {
            let color = '#000000'; // Default to black
            if (activeObject.type === 'group') { // Player
                const playerBody = activeObject.getObjects('circle')[0];
                if (playerBody) color = playerBody.fill;
            } else if (activeObject.fill) {
                color = activeObject.fill;
            }
            // For lines, stroke is the color
            if (activeObject.stroke) {
                color = activeObject.stroke;
            }
            objectColorPicker.value = color;
        }
    });

    canvas.on('selection:cleared', () => {
        objectColorPicker.value = '#0000ff'; // Reset to default blue when nothing is selected
    });

    // --- Initial Load --- //
    const today = new Date().toISOString().split('T')[0];
    planDateInput.value = today;
    loadAllSessions();
    handleDateChange();
});