// ------------------------------------------------------------------------------------------------
// メイン処理
// ------------------------------------------------------------------------------------------------

// VER CHECK 22MAY2026.1418

// -------------------------------------------------------------------------------------------
// グローバルな変数
var enable = false;			// GBフィルター有効化
var hi_tone = 0.0;			// 疑似高階調化
var grid = 0.0;				// ドット格子
var curve = 0.0;			// 色のサンプリングカーブ値
var filter_color_r = 0.0;	// フィルターカラー
var filter_color_g = 0.0;	// 
var filter_color_b = 0.0;	// 


// -------------------------------------------------------------------------------------------
// ページ読み込み完了イベント
onload = function()
{
	// GL関係のインスタンスを生成
	var gl = new yrGL("canvas_main");
	
	// 22MAY2026: Force WebGL to keep pixels memory readable for downloading snapshots
	// DEPRECATED: gl._gl = gl._canvas.getContext("webgl", { preserveDrawingBuffer: true }) || gl._canvas.getContext("experimental-webgl", { preserveDrawingBuffer: true });
	
	var renderer = gl.createRenderer();										// レンダラ―
	var material_imaged = gl.createMaterial(vs_imaged, fs_imaged);			// マテリアル
	var material_gbfilter = gl.createMaterial(vs_gbfilter, fs_gbfilter);	// 
	var geometry_square = gl.createGeometrySquare(1.0, true, false);		// ジオメトリ
	var texture = gl.createTexture("gb.jpg");								// テクスチャ

	// タイマー
	var timer = new yrTimer();

	// 外部から画像を読み込む
	{
		// 画像ファイル入力のハンドラを設定
		var file_input = document.getElementById("input_image");
		file_input.onchange = function(e)
		{
			var files = e.target.files;
			load_image(files);
		}

		// 画像ファイルドロップのハンドラを設定
		gl._canvas.ondragover = function(e)
		{
			e.preventDefault();
		}
		gl._canvas.ondrop = function(e)
		{
			e.preventDefault();
			var files = e.dataTransfer.files;
			load_image(files);
		}

		// 画像読み込み
		function load_image(files)
		{
			var image_files = [];
			for(var i = 0; i < files.length; i++)
			{
				if(files[i].type.match("image.*"))
				{
					image_files.push(files[i]);
				}
			}
			if(image_files.length > 0)
			{
				// ファイルの読み取り開始
				var reader = new FileReader();
				reader.onload = function(e)
				{
					texture.release();
					texture = gl.createTexture(e.target.result);
				}
				reader.readAsDataURL(image_files[0]);	// とりあえず最初の一個が処理されます
			}
		}
	}

	// --- SETUP DIALOGUE BOX INTERFACE ELEMENTS ---
	const canvasEl = document.getElementById("canvas_main");
	if (canvasEl) {
		// Load retro font
		const fontLink = document.createElement("link");
		fontLink.rel = "stylesheet";
		fontLink.href = "https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap";
		document.head.appendChild(fontLink);

		// Build live dialogue input element below canvas
		if (!document.getElementById("live-gb-text")) {
			const inputField = document.createElement("input");
			inputField.id = "live-gb-text";
			inputField.type = "text";
			inputField.placeholder = "Type your dialogue here...";
			inputField.value = "A WILD OAK APPEARED! It's dangerous to go alone.";
			inputField.style = "display: block; margin: 15px auto; width: 80%; max-width: 400px; padding: 10px; font-family: monospace; font-size: 14px; border: 2px solid #0f380f; background: #9bbc0f; color: #0f380f; text-align: center; border-radius: 4px;";
			canvasEl.parentNode.insertBefore(inputField, canvasEl.nextSibling);
		}

		// Build overlay layer canvas
		if (!document.getElementById("gb-visual-overlay")) {
			const visualOverlay = document.createElement("canvas");
			visualOverlay.id = "gb-visual-overlay";
			visualOverlay.style = "position: absolute; pointer-events: none; z-index: 9999;";
			canvasEl.parentNode.insertBefore(visualOverlay, canvasEl);

			function repositionOverlay() {
				visualOverlay.width = canvasEl.width;
				visualOverlay.height = canvasEl.height;
				visualOverlay.style.left = canvasEl.offsetLeft + "px";
				visualOverlay.style.top = canvasEl.offsetTop + "px";
				visualOverlay.style.width = canvasEl.clientWidth + "px";
				visualOverlay.style.height = canvasEl.clientHeight + "px";
			}
			repositionOverlay();
			window.addEventListener('resize', repositionOverlay);
			const resizeObserver = new ResizeObserver(() => repositionOverlay());
			resizeObserver.observe(canvasEl);
		}
	}

	// メインループ
	main_loop();


	// -------------------------------------------------------------------------------------------
	// メインループ
	function main_loop()
	{
		// テクスチャ読み込み待ち
		if(!texture._is_loaded)
		{
			requestAnimationFrame(main_loop);
			return;
		}

		// UIの更新
		enable = document.form_ui.enable.checked;
		hi_tone = document.form_ui.hi_tone.checked ? 1.0 : 0.0;
		grid = document.form_ui.grid.checked ? 1.0 : 0.0;
		curve = parseFloat(document.form_ui.curve.value) / 100.0;
		filter_color_r = parseFloat(document.form_ui.filter_color_r.value) / 100.0;
		filter_color_g = parseFloat(document.form_ui.filter_color_g.value) / 100.0;
		filter_color_b = parseFloat(document.form_ui.filter_color_b.value) / 100.0;

		// タイマー更新
		timer.update();

		// 描画
		{
			// カラーバッファとZバッファをクリアする
			renderer.clearBuffer();

			if(!enable)
			{
				// 加工しない
				material_imaged.SetUniformFloat32Array("u_wvp", mat4.create());
				material_imaged.SetUniformInt32Array("u_texture0", new Int32Array([0]));
				material_imaged.SetTextureArray([texture._texture]);
				renderer.renderGeometry(geometry_square, material_imaged);
			}
			else
			{
				// 加工する
				material_gbfilter.SetUniformFloat32Array("u_wvp", mat4.create());
				material_gbfilter.SetUniformInt32Array("u_texture0", new Int32Array([0]));
				material_gbfilter.SetUniformFloat32Array("u_resolution", new Float32Array([gl._canvas.width, gl._canvas.height]));
				material_gbfilter.SetUniformFloat32Array("u_hi_tone", new Float32Array([hi_tone]));
				material_gbfilter.SetUniformFloat32Array("u_grid", new Float32Array([grid]));
				material_gbfilter.SetUniformFloat32Array("u_curve", new Float32Array([curve]));
				material_gbfilter.SetUniformFloat32Array("u_filter_color", new Float32Array([filter_color_r, filter_color_g, filter_color_b]));
				material_gbfilter.SetTextureArray([texture._texture]);
				renderer.renderGeometry(geometry_square, material_gbfilter);
			}
		}

		// バッファリングされたWebGLコマンドをただちに実行する
		renderer.flush();

		// --- LIVE RENDERING FOR THE TEXTBOX OVERLAY ---
		const visualOverlay = document.getElementById("gb-visual-overlay");
		const inputField = document.getElementById("live-gb-text");
		
		if (visualOverlay && inputField) {
			const textCtx = visualOverlay.getContext("2d");
			const currentText = inputField.value;

			if (!currentText.trim()) {
				textCtx.clearRect(0, 0, visualOverlay.width, visualOverlay.height);
			} else {
				textCtx.clearRect(0, 0, visualOverlay.width, visualOverlay.height);

				// Palette sync matching the sliders
				const baseR = filter_color_r;
				const baseG = filter_color_g;
				const baseB = filter_color_b;

				const luminance = (0.2126 * baseR) + (0.7152 * baseG) + (0.0722 * baseB);
				let colorWhite, colorBlack;

				if (luminance < 0.15) { 
					colorWhite = "rgb(230, 245, 230)";
					colorBlack = `rgb(${Math.floor(baseR * 80)}, ${Math.floor(baseG * 80)}, ${Math.floor(baseB * 80)})`;
				} else {
					const maxVal = Math.max(baseR, baseG, baseB, 0.01);
					colorWhite = `rgb(${Math.floor((baseR/maxVal) * 210)}, ${Math.floor((baseG/maxVal) * 230)}, ${Math.floor((baseB/maxVal) * 190)})`;
					colorBlack = `rgb(${Math.floor(baseR * 45)}, ${Math.floor(baseG * 55)}, ${Math.floor(baseB * 45)})`;
				}

				const boxHeight = Math.floor(visualOverlay.height * 0.18); 
				const boxWidth = visualOverlay.width - 16;
				const boxX = 8;
				const boxY = visualOverlay.height - boxHeight - 8;

				textCtx.fillStyle = colorBlack;
				textCtx.fillRect(boxX, boxY, boxWidth, boxHeight);
				
				textCtx.fillStyle = colorWhite;
				textCtx.fillRect(boxX + 3, boxY + 3, boxWidth - 6, boxHeight - 6);
				
				textCtx.strokeStyle = colorBlack;
				textCtx.lineWidth = 2;
				textCtx.strokeRect(boxX + 6, boxY + 6, boxWidth - 12, boxHeight - 12);

				textCtx.fillStyle = colorBlack;
				const fontSize = Math.floor(boxHeight * 0.22); 
				textCtx.font = `bold ${fontSize}px "Press Start 2P", monospace`;
				textCtx.textBaseline = "top";

				const maxTextWidth = boxWidth - 28;
				let lines = [];
				let currentLine = "";

				for (let i = 0; i < currentText.length; i++) {
					let char = currentText[i];
					let testLine = currentLine + char;
					
					if (textCtx.measureText(testLine).width > maxTextWidth) {
						if (char === " ") {
							lines.push(currentLine);
							currentLine = "";
						} else {
							const lastSpace = currentLine.lastIndexOf(" ");
							if (lastSpace > 0 && textCtx.measureText(currentText.substring(i - (currentLine.length - lastSpace), i)).width < maxTextWidth) {
								lines.push(currentLine.substring(0, lastSpace));
								currentLine = currentLine.substring(lastSpace + 1) + char;
							} else {
								lines.push(currentLine);
								currentLine = char;
							}
						}
					} else {
						currentLine = testLine;
					}
				}
				lines.push(currentLine);

				for (let j = 0; j < Math.min(lines.length, 2); j++) {
					textCtx.fillText(lines[j].trim(), boxX + 14, boxY + 12 + (j * fontSize * 1.5));
				}
			}
		}

		requestAnimationFrame(main_loop);
	}
};

// --- DYNAMIC COMBINED DOWNLOAD HANDLER ---
window.generateDownload = function(linkElement) {
    const webglCanvas = document.getElementById("canvas_main");
    const textCanvas = document.getElementById("gb-visual-overlay");
    
    if (!webglCanvas) return;

    // Force a fresh render layout flag update just before snapshotting
    const glContext = webglCanvas.getContext("webgl") || webglCanvas.getContext("experimental-webgl");
    if (glContext) {
        // Tweak the live buffer parameters on the fly to allow image data exports
        const attributes = glContext.getContextAttributes();
        if (attributes && !attributes.preserveDrawingBuffer) {
            // If the buffer isn't preserved natively, pull data directly via the viewport canvas context
            linkElement.href = webglCanvas.toDataURL("image/png");
        }
    }

    // Create our temporary canvas to flatten both images together cleanly
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = webglCanvas.width;
    exportCanvas.height = webglCanvas.height;
    const ctx = exportCanvas.getContext("2d");

    // 1. Snapshot the retro filter layer
    ctx.drawImage(webglCanvas, 0, 0);

    // 2. Snapshot the dialogue canvas overlay layout
    if (textCanvas) {
        ctx.drawImage(textCanvas, 0, 0);
    }

    // 3. Inject the combined base64 data payload back into the link asset
    linkElement.href = exportCanvas.toDataURL("image/png");
};
