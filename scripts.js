let image_spacing = 15;
let min_image_size = 100;

function createCanvas(canvasId) {
    let canvas = document.createElement("canvas");
    if (canvasId != null)
        canvas.setAttribute("id", canvasId);
    
    let ctx = canvas.getContext("2d", {"willReadFrequently": true});
    ctx.imageSmoothingEnabled = false;
    return {canvas: canvas, ctx: ctx};
}

class MinecraftGenerator {
    // wrapper class for the generator
    constructor(canvasWrapper, textarea, settings) {
        this.canvasWrapper = canvasWrapper;
        this.textarea = textarea;
        this.settings = settings;

        this.textRenderer = new TextGenerator(this.settings);
        this.textRenderer.setText(textarea.value);
        this.blockRenderer = new BlockRenderingEngine(400, 400, document.getElementById("skin-image"));
        this.canvasWrapper.appendChild(this.textRenderer.canvas);

        this.textCanvas = this.textRenderer.canvas;
        let combinedCanvas = createCanvas("combined-canvas");
        this.combinedCanvas = combinedCanvas.canvas;
        this.combinedctx = combinedCanvas.ctx;
        this.canvasWrapper.appendChild(this.combinedCanvas);
        this.combinedctx.imageSmoothingEnabled = false;

        this.hasBlockRendered = false;
        (this.hasBlockRendered ? this.combinedCanvas : this.textCanvas).classList.add("active");

        // creating listener for text area
        this.textarea.addEventListener("input", (event) => {
            this.textRenderer.setText(event.target.value);
            if (this.settings.updatePeriod == 0)
                this.redrawImage();
        });

        // generator refresh settings.
        this.timeout = undefined;
        this.isValid = false;
        this.updatePeriodChange(this.settings.updatePeriod);

        // creating listeners for all settings so that the generator remains up to date
        this.settings.getCallback("first-line-gap").addListener((value) => this.forceRerender());
        this.settings.getCallback("render-background").addListener((value) => this.forceRerender());
        this.settings.getCallback("font-version").addListener(value => this.forceRerender());
        this.settings.getCallback("image-scale").addListener((value) => this.changeWrapperSize());
        this.settings.getCallback("update-period").addListener((value) => this.updatePeriodChange(value));
        this.settings.getCallback("include-display-item").addListener((value) => {
            this.hasBlockRendered = value;
            this.forceRerender();
        });
        this.settings.getCallback("display-item-size").addListener((value) => this.forceRerender());
        this.settings.getCallback("item-tint-layer-1").addListener((value) => this.blockRenderer.setTintLayer(value, 0));
        this.settings.getCallback("item-tint-layer-2").addListener((value) => this.blockRenderer.setTintLayer(value, 1));
    }

    forceRerender(_) {
        // force a refresh, respecting the screen refresh setting
        this.isValid = false;
        if (this.timeout == undefined) {
            this.redrawImage();
        }
    }

    async redrawImage() {
        let isValid = this.textRenderer.isValid && this.blockRenderer.isValid && this.isValid;
        if (isValid)
            return;

        // redraws the screen if it needs to
        await this.textRenderer.render();
        this.blockRenderer.render();

        let activeCanvas, inactiveCanvas;
        if (this.hasBlockRendered) {
            this.redrawCombinedCanvas();
            activeCanvas = this.combinedCanvas;
            inactiveCanvas = this.textCanvas;
        } else {
            activeCanvas = this.textCanvas;
            inactiveCanvas = this.combinedCanvas;
        }
        
        this.changeWrapperSize();

        inactiveCanvas.classList.remove("active");
        activeCanvas.classList.add("active");
        this.isValid = true;
    }

    redrawCombinedCanvas() {
        let width, height, itemSideLength;

        // calculate the canvas size
        if (this.settings.displayItemSize == "ratio")
            itemSideLength = Math.max(min_image_size, 2/3 * this.textRenderer.height) | 0;
        else if (this.settings.displayItemSize == "match-height")
            itemSideLength = this.textRenderer.height;
        else
            itemSideLength = this.textRenderer.width;

        width = image_spacing * 3 + this.textRenderer.width + itemSideLength;
        height = image_spacing * 2 + Math.max(this.textRenderer.height, itemSideLength);
        
        this.combinedCanvas.width = width;
        this.combinedCanvas.height = height;
        this.combinedctx.imageSmoothingEnabled = false;
        this.combinedctx.drawImage(this.textRenderer.canvas, image_spacing * 2 + itemSideLength, (height / 2 - this.textRenderer.height / 2) | 0);
        this.combinedctx.drawImage(this.blockRenderer.canvas, 0, 0, this.blockRenderer.width, this.blockRenderer.height, image_spacing, (height / 2 - itemSideLength / 2) | 0, itemSideLength, itemSideLength);
    }

    updatePeriodChange(value) {
        // change the delay in when the screen is being updated
        this.delay = value;
        // clearing any intervals if there is no delay in timeouts
        if (value == 0) {
            clearInterval(this.timeout);
            this.timeout = undefined;
        } else {
            // creating a timeout to refresh the screen
            if (this.timeout != undefined) {
                clearInterval(this.timeout);
            }
            this.timeout = setInterval(this.redrawImage.bind(this), this.delay * 1000);
        }
    }

    changeWrapperSize() {
        let activeCanvas = this.hasBlockRendered ? this.combinedCanvas : this.textCanvas;
        
        this.canvasWrapper.style.width = `${activeCanvas.width * this.settings.imageScale}px`;
        this.canvasWrapper.style.height = `${activeCanvas.height * this.settings.imageScale}px`;
        activeCanvas.style.transform = `scale(${this.settings.imageScale})`;
    }

    async getImageFromCanvas(canvas) {
        return new Promise((resolve, reject) => {
            canvas.toBlob((blob) => {
                if (blob) {
                    resolve(blob);
                } else {
                    reject(new Error("Couldn't convert the canvas to a blob"));
                }
            })
        })
    }

    async copyToClipboard() {
        try {
            const blob = await this.getImageFromCanvas(this.hasBlockRendered ? this.combinedCanvas : this.textRenderer.canvas);
            const data = [new ClipboardItem({[blob.type]: blob})];
            await navigator.clipboard.write(data);
        } catch (error) {
            console.log(error);
        }
    }

    async downloadImage(imageName) {
        let blob;
        let fileFormat;
        if (this.textRenderer.textContent.hasObfuscatedText() && !this.hasBlockRendered) {
            const encoder = new GifEncoder();
            encoder.createImage(this.textRenderer, 6);
            fileFormat = "gif";
            blob = new Blob([encoder.stream], { type: 'image/gif' });
        } else {
            blob = await this.getImageFromCanvas(this.hasBlockRendered ? this.combinedCanvas : this.textRenderer.canvas);
            fileFormat = "png";
        }

        try {
            const dataURL = URL.createObjectURL(blob);
            let link = document.createElement('a');
            link.style.display = "none";
            link.setAttribute('download', `${imageName}.${fileFormat}`);
            link.href = dataURL;

            document.body.appendChild(link);
            link.click();

            URL.revokeObjectURL(dataURL);
            document.body.removeChild(link);
        } catch (error) {
            console.log(error);
        }
    }
}

class TextGenerator {
    constructor(settings) {
        this.textContent = new TextManager(settings);
        let mainCanvas = createCanvas(null);
        this.canvas = mainCanvas.canvas;
        this.ctx = mainCanvas.ctx;

        this.settings = settings;
        this.text = "";

        let textCanvas = createCanvas(null);
        this.textCanvas = textCanvas.canvas;
        this.textCanvas.width = 1000;
        this.textCanvas.height = 100;
        this.tctx = textCanvas.ctx;
        this.tctx.fillStyle = "white";

        let obfuscatedCanvas = createCanvas(null);
        this.obfuscatedCanvas = obfuscatedCanvas.canvas;
        this.obfuscatedCanvas.width = 1000;
        this.obfuscatedCanvas.height = 100;
        this.octx = obfuscatedCanvas.ctx;
        this.octx.fillStyle = "white";

        this.changeCanvasSize((LEFT_OFFSET) * 2, (TOP_OFFSET) * 2 + FONT_SIZE, false);

        this.colors = null;
        this.obfuscatedSegments = null;

        this.isValid = true;
    }

    convertLineToYCoord(yValue) {
        // converts a specific line into a Y value on the image, adjusting for if the first line gap is needed
        return TOP_OFFSET + yValue * LINE_HEIGHT + ((yValue > 0 && this.settings.firstLineGap) ? 2 * dpi : 0);
    }

    drawText(text, x, styles) {
        // draws the text onto the generator, applying any styles.
        var spriteWidth = 16;

        var styleOffset = 0;
        if (styles.isBold && text.length > 0) {
            styleOffset += dpi;
        }
        let currentGlyphPageCode = -1;
        let glyphPage = undefined;

        // draw each character into the buffer
        var lineWidth = 0;
        for (var i = 0; i < text.length; i++) {
            var characterCode = text.codePointAt(i);
            let unicode = ("0000" + characterCode.toString(16)).slice(-4);
            let page = parseInt(unicode.slice(0, 2), 16);
            let code = parseInt(unicode.slice(-2), 16);

            if (page != currentGlyphPageCode) {
                currentGlyphPageCode = page;
                glyphPage = GLYPHS[this.settings.fontVersion][page];
            }

            let spriteX = (code % 16) * spriteWidth;
            let spriteY = parseInt(code / 16) * spriteWidth;
            this.tctx.drawImage(glyphPage.fontImage, spriteX, spriteY, spriteWidth, spriteWidth, lineWidth, 0, 16, 16);
            lineWidth += (glyphPage.getGlyphWidth(code) + dpi) + styleOffset;
        }

        if (styles.isBold) {
            // drawing a copy shifted to the left 1px
            this.tctx.drawImage(this.textCanvas, 0, 0, lineWidth * dpi, 16, dpi, 0, lineWidth * dpi, 8 * dpi);
        }
        if (styles.isItalic) {
            // skew the image similar to how minecraft does it.
            var row;
            var offset = 4;
            var height = 1 * dpi;
            var i = 0;
            lineWidth += dpi * 2 - 1; // applies the offset as italics makes the line slightly bigger
            while (i < 16) {
                row = this.tctx.getImageData(0, i, lineWidth, height);
                this.tctx.clearRect(0, i, lineWidth, height);
                this.tctx.putImageData(row, offset, i);

                offset -= 1;
                i += height;
                height = (i + 2 < 16 ? 2 : 1) * dpi;
            }
        }
        if (styles.isStrikethrough) {
            // draws a line
            this.tctx.fillRect(0, 6, lineWidth, 2);
        }
        if (styles.isUnderline) {
            // draws the underline
            this.tctx.fillRect(0, 16, lineWidth, 2);
        }
        
        // check if the image needs extending and extend it if it needs to
        if (x + lineWidth > this.drawableWidth) {
            this.changeCanvasSize(x + lineWidth + LEFT_OFFSET, this.height, true);
        }

        return lineWidth;
    }

    randomizeText(length) {
        let finalString = "";
        let characterList = OBFUSCATED_CHARACTER_REPLACEMENT[this.settings.fontVersion];
        let currentIndex = Math.floor(Math.random() * characterList.length);

        while (finalString.length < length) {
            let newEnd = Math.min(characterList.length, currentIndex + length - finalString.length);
            finalString += characterList.substring(currentIndex, newEnd);
            currentIndex = newEnd >= characterList.length ? 0 : newEnd;
        }
        
        return finalString;
    }

    renderText(text, x, y, styles, target=null) {
        if (target == null) {
            target = this.ctx;
        }

        if (styles.isObfuscated) {
            text = this.randomizeText(text.length);
        }

        let lineWidth = this.drawText(text, x, styles);
        var fontOffsets = styles.isItalic ? -1 : 0 + styles.isStrikethrough ? -dpi : 0;
        
        // draw the drop shadow for the text
        this.tctx.globalCompositeOperation = "source-in";
        this.tctx.fillStyle = styles.color.dropShadow;
        this.tctx.fillRect(0, 0, lineWidth, 18);
        target.drawImage(this.textCanvas, 0, 0, lineWidth, FONT_SIZE + 4, x + dpi + fontOffsets, y + dpi, lineWidth, FONT_SIZE + 4);

        if (styles.isObfuscated) {
            // clear the buffer and update the current x position
            this.tctx.globalCompositeOperation = "source-over";
            this.tctx.clearRect(0, 0, lineWidth, 18);
            
            // drawing more scrambled text
            text = this.randomizeText(text.length);
            this.drawText(text, x, styles);
            this.tctx.globalCompositeOperation = "source-in";
        }

        // draw the main text for the text
        this.tctx.fillStyle = styles.color.color;
        this.tctx.fillRect(0, 0, lineWidth, 18);
        target.drawImage(this.textCanvas, 0, 0, lineWidth, FONT_SIZE + 2, x + fontOffsets, y, lineWidth, FONT_SIZE + 2);

        // clear the buffer and update the current x position
        this.tctx.globalCompositeOperation = "source-over";
        this.tctx.clearRect(0, 0, lineWidth, 18);

        if (styles.isItalic) {
            lineWidth -= 2;
        }

        return lineWidth;
    }

    drawBackground() {
        if (!this.settings.renderBackground) {
            return;
        }

        // drawing the main background
        this.ctx.fillStyle = backgroundColor;
        this.ctx.fillRect(spacing, spacing, this.width - spacing * 2, this.height - spacing * 2);

        // punching out the corners
        var corners = [
            [spacing, spacing], 
            [this.width - spacing * 2, spacing], 
            [this.width - spacing * 2, this.height - spacing * 2],
            [spacing, this.height - spacing * 2]
        ]
        corners.forEach(element => this.ctx.clearRect(element[0], element[1], dpi, dpi));

        // drawing the purple border
        this.ctx.strokeStyle = borderColor;
        this.ctx.lineWidth = dpi;
        var imageSpacing = spacing + dpi * 1.5;
        this.ctx.strokeRect(imageSpacing, imageSpacing, this.width - imageSpacing * 2, this.height - imageSpacing * 2);
    }

    changeCanvasSize(width, height, saveData) {
        if (saveData) {
            var savedData = this.ctx.getImageData(LEFT_OFFSET, TOP_OFFSET, 
                Math.min(this.width, width) - LEFT_OFFSET * 2 + dpi, 
                Math.min(this.height, height) - TOP_OFFSET * 2 + dpi * 2);
        }

        this.canvas.width = width;
        this.canvas.height = height;
        this.width = width;
        this.height = height;
        this.drawableWidth = width - LEFT_OFFSET;

        this.drawBackground();
        if (saveData) {
            this.ctx.putImageData(savedData, LEFT_OFFSET, TOP_OFFSET);
        }
    }

    get canvasWidth() {
        return this.canvas.width;
    }

    get canvasHeight() {
        return this.canvas.height;
    }

    initialiseGif() {
        let data = this.textContent.getSegmentData();
        this.colors = data[0];
        this.obfuscatedSegments = data[1];

        this.obfuscatedCanvas.width = this.canvas.width;
        this.obfuscatedCanvas.height = this.canvas.height;
    }

    get imageColors() {
        return this.colors;
    }

    getBaseFrame() {
        return this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    }

    * frameGenerator() {
        this.obfuscatedCanvas.width = this.canvas.width;
        this.obfuscatedCanvas.height = this.canvas.height;

        let left = Number.MAX_SAFE_INTEGER;
        let right = Number.MIN_SAFE_INTEGER;
        let top = this.obfuscatedSegments[0].y;
        let bottom = this.obfuscatedSegments[this.obfuscatedSegments.length - 1].y + LINE_HEIGHT;

        this.obfuscatedSegments.forEach(segment => {
            segment.width = this.renderText(segment.text, segment.x, segment.y, segment, this.octx);
            left = Math.min(segment.x, left);
            right = Math.max(segment.x + segment.width, right);
        });

        this.octx.fillStyle = backgroundColor;
        while (true) {
            this.obfuscatedSegments.forEach(segment => {
                if (this.settings.renderBackground)
                    this.octx.fillRect(segment.x, segment.y, segment.width, LINE_HEIGHT);
                this.renderText(segment.text, segment.x, segment.y, segment, this.octx);
            });

            yield [this.octx.getImageData(left, top, right - left, bottom - top), left, top];
        }
    }

    setText(text) {
        this.text = text;
        this.isValid = false;
    }

    async render() {
        if (this.isValid)
            return;
    
        await this.textContent.splitText(this.text);
        
        let height = this.convertLineToYCoord(this.textContent.lines.length - 1) + FONT_SIZE + TOP_OFFSET;
        this.changeCanvasSize(LEFT_OFFSET * 2, height, false);
        // iterate over all the lines, drawing each section based on it's color
        this.textContent.lines.forEach((line, index) => {
            let y = this.convertLineToYCoord(index);
            let segments = line.segments;
            
            for (let i = 0; i < line.length; i++) {
                let segment = segments[i];
                if (!segment.isValid) {
                    segment.y = y;
                    const width = this.renderText(segment.text, segment.x, segment.y, segment);
                    if (i + 1 < segments.length && segment.x + width != segments[i + 1].x) {
                        segments[i + 1].x = segment.x + width;
                        segments[i + 1].isValid = false;
                    }
                }
            }
        });

        this.isValid = true;
    }
}

class MCColor {
    constructor(code, name, color, dropShadow) {
        this.code = code;
        this.name = name;
        this.color = color;
        this.dropShadow = dropShadow;
    }

    toString() {
        return this.name;
    }
}

class MCCode {
    constructor(code, name, shorthand, style) {
        this.code = code;
        this.name = name;
        this.shorthand = shorthand;
        this.styleIndex = 0;
        this.style = style;
    }

    toString() {
        return this.name;
    }
}

class MCStat {
    constructor(statData) {
        this.icon = statData["icon"];
        this.stat = statData["name"];
        this.color = statData["color"];
    }
}

function minecraftShadow(hex) {
    let colorInt = parseInt(hex.replace(/^#/, ""), 16);
    let shadowInt = (colorInt & 0xFCFCFC) >> 2;
    return "#" + shadowInt.toString(16).padStart(6, "0");
}

class TextManager {
    constructor(settings) {
        this.lines = [];
        this.settings = settings;
    }

    get length() {
        return this.lines.length;
    }

    async splitText(text) {
        for (const character of text) {
            let characterCodePage = Math.floor(character.codePointAt(0) / 256);
            if (!GLYPHS[this.settings.fontVersion][characterCodePage].isReady) {
                let successfulLoading = await GLYPHS[this.settings.fontVersion][characterCodePage].load()
                if (!successfulLoading) {
                    return;
                }
            }
        }

        this.lines = [];
        let textLines = text.split("\n");

        var currentColor = DEFAULT_COLOR;
        var styles = DEFAULT_STYLES.slice();
        
        textLines.forEach((currentText) => {
            let currentLine = new Line(currentColor, styles);
            let currentIndex = 0;
            let stopIndex = 0;
            let regex = currentText.matchAll(/&/g);
            let currentSection, currentMatch;

            while (currentIndex < currentText.length) {
                currentMatch = regex.next();
                
                stopIndex = !currentMatch.done ? currentMatch.value.index : currentText.length;
                currentSection = currentText.substring(currentIndex, stopIndex);

                if (currentSection.length == 0) {
                    continue;
                }
                else if (currentSection.length > 8 && currentSection.startsWith("&#")) {
                    let hexCandidate = currentSection.substring(1, 8);
                    if (/^#[0-9a-fA-F]{6}$/.test(hexCandidate)) {
                        styles = DEFAULT_STYLES.slice();
                        currentColor = new MCColor(null, "CUSTOM", hexCandidate, minecraftShadow(hexCandidate));
                        currentLine.add(new LineSegment(currentSection.substring(8), currentColor, styles));
                    } else {
                        currentLine.segments[currentLine.length - 1].add(currentSection);
                    }
                }
                else if (currentSection.length == 1 || currentSection.charAt(0) != "&" || !(REGISTERED_CODES.includes(currentSection.charAt(1)))) {
                    currentLine.segments[currentLine.length - 1].add(currentSection);
                }
                else {
                    let character = currentSection.charAt(1);
                    if (character in COLOR_CODES) {
                        styles = DEFAULT_STYLES.slice();
                        currentColor = COLOR_CODES[character];
                        currentLine.add(new LineSegment(currentSection.substring(2), currentColor, styles));
                    }
                    else {
                        var targetSegment = currentLine.segments[currentLine.length - 1];
                        let style = STYLE_CODES[character];

                        if (targetSegment.length > 0) {
                            targetSegment = new LineSegment("", currentColor, styles);
                            currentLine.add(targetSegment);
                        }

                        if (style.code == "r") {
                            currentColor = DEFAULT_COLOR;
                            targetSegment.setColor(currentColor);
                            styles = DEFAULT_STYLES;
                        }
                        else {
                            styles[style.styleIndex] = true;
                        }

                        targetSegment.setStyles(styles);
                        targetSegment.add(currentSection.substring(2));
                    }
                }
                
                currentIndex = stopIndex;
            }

            this.lines.push(currentLine);
        });
    }

    getSegmentData() {
        let colors = new Set(["transparent", backgroundColor, borderColor]);
        let obfuscatedSegments = new Array();
        
        this.lines.forEach((line) => {
            line.lineSegments.forEach(segment => {
                colors.add(segment.color.color);
                colors.add(segment.color.dropShadow);
                
                if (segment.isObfuscated) {
                    obfuscatedSegments.push(segment);
                }
            });
        });

        return [colors, obfuscatedSegments];
    }

    hasObfuscatedText() {
        return this.lines.some(line => 
            line.lineSegments.some(segment => segment.isObfuscated)
        );
    }

    toString() {
        var result = "|";
        this.lines.forEach(element => {
            result += element.toString();
            result += "\n";
        });
        result += "|";
        return result;
    }
}

class Line {
    constructor(color, styles=DEFAULT_STYLES) {
        this.x = LEFT_OFFSET;
        this.lineSegments = [new LineSegment("", color, styles)];
    }

    get length() {
        return this.lineSegments.length;
    }

    get segments() {
        return this.lineSegments;
    }

    moveXPos(amount) {
        this.x += amount;
    }

    add(segment) {
        this.lineSegments.push(segment);
    }

    toString() {
        var length = 0
        var result = "";
        this.lineSegments.forEach(element => {
            result += element.toString();
            result += " ";      
        });
        return result + length;
    }
}

class LineSegment {
    constructor(text, color, styles) {
        this.text = text;

        this.x = LEFT_OFFSET;
        
        this.color = color;
        this.setStyles(styles);

        this.isValid = false;
        this.segmentWidth = 0;
    }

    get length() {
        return this.text.length;
    }

    get width() {
        return this.segmentWidth;
    }

    set width(value) {
        this.segmentWidth = value;
    }

    add(text) {
        this.text += text;
    }

    hasSameStyles(styles) {
        return this.isBold == styles[0] && this.isStrikethrough == styles[1] 
            && this.isUnderline == styles[2] && this.isItalic == styles[3] && this.isObfuscated == styles[4];;
    }

    setColor(color) {
        this.color = color;
    }

    setStyles(styles) {
        this.isBold = styles[0];
        this.isStrikethrough = styles[1];
        this.isUnderline = styles[2];
        this.isItalic = styles[3];
        this.isObfuscated = styles[4];
    }

    draw() {
        this.isValid = true;
    }

    toString() {
        return `${this.color} (${this.text})`
    }
}

class Callback {
    constructor(initial) {
        this._callbacks = [];
        this._value = initial;
    }

    get value() {
        return this._value;
    }

    set value(value) {
        this._value = value;
        this.invoke(this._value);
    }

    addListener(handler) {
        this._callbacks.push(handler);
    }

    invoke(value) {
        this._callbacks.forEach(element => {
            element(value);
        });
    }
}

class Settings {
    constructor() {
        // item display settings
        this._includeDisplayItem = new Callback(false);
        this._displayItemSize = new Callback("ratio");
        this._itemTintLayer1 = new Callback("#000000");
        this._itemTintLayer2 = new Callback("#ffffff");
        // image settings
        this._firstLineGap = new Callback(true);
        this._renderBackground = new Callback(true);
        this._fontVersion = new Callback(0);
        // editor settings
        this._updatePeriod = new Callback(2);
        this._imageScale = new Callback(window.innerWidth < 480 ? 1.5 : 2);
        
        this._settingBindings = {
            "first-line-gap": this._firstLineGap,
            "render-background": this._renderBackground,
            "font-version": this._fontVersion,
            "update-period": this._updatePeriod,
            "image-scale": this._imageScale,
            "include-display-item": this._includeDisplayItem,
            "display-item-size": this._displayItemSize,
            "item-tint-layer-1": this._itemTintLayer1,
            "item-tint-layer-2": this._itemTintLayer2
        }
    }

    get firstLineGap() {
        return this._firstLineGap.value;
    }

    get renderBackground() {
        return this._renderBackground.value;
    }

    get fontVersion() {
        return this._fontVersion.value;
    }

    get updatePeriod() {
        return this._updatePeriod.value;
    }

    get imageScale() {
        return this._imageScale.value;
    }

    get includeDisplayItem() {
        return this._includeDisplayItem.value;
    }

    get displayItemSize() {
        return this._displayItemSize.value;
    }

    get itemTintLayer1() {
        return this._itemTintLayer1.value;
    }

    get itemTintLayer2() {
        return this._itemTintLayer2.value;
    }

    getSetting(setting) {
         if (setting in this._settingBindings) {
            return this._settingBindings[setting].value;
        }
        else {
            console.warn(`Couldn't change the setting "${setting}"`);
            return 0;
        }
    }

    changeSetting(setting, value) {
        if (setting in this._settingBindings) {
            this._settingBindings[setting].value = value;
        }
        else {
            console.warn(`Couldn't change the setting "${setting}"`);
        }
    }

    getCallback(setting) {
        if (setting in this._settingBindings) {
            return this._settingBindings[setting];
        }
        else {
            console.warn(`Couldn't find the setting "${setting}"`);
            return undefined;
        }
        
    } 
}

class GlyphSprite {
    constructor(glyphWidths, unicodePage) {
        this.glyphWidths = glyphWidths;
        this.unicodePage = unicodePage;
        this.fontImage = undefined;
        this.loadedSuccessful = false;
    }
    
    get image() {
        return this.fontImage;
    }

    get isReady() {
        return this.loadedSuccessful;
    }

    getGlyphWidth(characterIndex) {
        return this.glyphWidths[characterIndex];
    }

    async load() {
        this.fontImage = new Image();
        this.fontImage.crossOrigin = "anonymous";
        this.fontImage.style.background = "#000";
        return new Promise((resolve) => {
            this.fontImage.onload = () => {
                this.loadedSuccessful = true;
                resolve(true);
            }
            this.fontImage.onerror = () => {
                console.error("Couldn't load file " + this.fontImage.src);
                resolve(false);
            }
            this.fontImage.src = `glyphs/${this.unicodePage}.png`;
        });
    }
}

const POTION_OPTIONS = {"Default": 3694022, "Speed": 3402751, "Slowness": 9154528, "Haste": 14270531, "Mining Fatigue": 4866583, "Strength": 16762624, "Instant Health": 16262179, 
            "Instant Damage": 11101546, "Jump Boost": 16646020, "Nausea": 5578058, "Regeneration": 13458603, "Resistance": 9520880, "Fire Resistance": 16750848, 
            "Water Breathing": 10017472, "Invisibility": 16185078, "Blindness": 2039587, "Night Vision": 12779366, "Hunger": 5797459, "Weakness": 4738376, 
            "Poison": 8889187, "Wither": 7561558, "Health Boost": 16284963, "Absorption": 2445989, "Saturation": 16262179, "Glowing": 9740385, "Levitation": 13565951, 
            "Fatal Poison": 5149489, "Luck": 5882118, "Bad Luck": 12624973, "Slow Falling": 15978425, "Conduit Power": 1950417, "Dolphin's Grace": 8954814, "Bad Omen": 745784, 
            "Hero of the Village": 4521796, "Darkness": 2696993, "T rial Omen": 1484454, "Raid Omen": 14565464, "Infested": 9214860, "Oozing": 10092451, "Weaving": 7891290, 
            "Wind Charged": 12438015, "Slowness Resistance": 9274086};
const DYE_OPTIONS = {"White": 16383998, "Orange": 16351261, "Magenta": 13061821, "Light Blue": 3847130, "Yellow": 16701501, "Lime": 8439583, "Pink": 15961002, "Gray": 4673362, 
            "Light Gray": 10329495, "Cyan": 1481884, "Purple": 8991416, "Blue": 3949738, "Brown": 8606770, "Green": 6192150, "Red": 11546150, "Black": 1908001};
const FIREWORK_OPTIONS = {"White": 15790320, "Orange": 15435844, "Magenta": 12801229, "Light Blue": 6719955, "Yellow": 14602026, "Lime": 4312372, "Pink": 14188952, 
    "Gray": 4408131, "Light Gray": 11250603, "Cyan": 2651799, "Purple": 8073150, "Blue": 2437522, "Brown": 5320730, "Green": 3887386, "Red": 11743532, "Black": 1973019
};
const ITEM_TINT_OPTIONS = {"potion": POTION_OPTIONS, "dye": DYE_OPTIONS, "firework": FIREWORK_OPTIONS};

const BLACK = new MCColor("0", "BLACK", "#000000", "#000000");
const DARK_BLUE = new MCColor("1", "DARK_BLUE", "#0000aa", "#00002a");
const DARK_GREEN = new MCColor("2", "DARK_GREEN", "#00aa00", "#002a00");
const DARK_AQUA = new MCColor("3", "DARK_AQUA", "#00aaaa", "#002a2a");
const DARK_RED = new MCColor("4", "DARK_RED", "#aa0000ff", "#2a0000");
const DARK_PURPLE = new MCColor("5", "DARK_PURPLE", "#aa00aa", "#2a002a");
const GOLD = new MCColor("6", "GOLD", "#ffaa00", "#2a2a00");
const GRAY = new MCColor("7", "GRAY", "#aaaaaa", "#2a2a2a");
const DARK_GRAY = new MCColor("8", "DARK_GRAY", "#555555", "#151515");
const BLUE = new MCColor("9", "BLUE", "#5555ff", "#15153f");
const GREEN = new MCColor("a", "GREEN", "#55ff55", "#153f15");
const AQUA = new MCColor("b", "AQUA", "#55ffff", "#153f3f");
const RED = new MCColor("c", "RED", "#ff5555", "#3f1515");
const LIGHT_PURPLE = new MCColor("d", "LIGHT_PURPLE", "#ff55ff", "#3f153f");
const YELLOW = new MCColor("e", "YELLOW", "#ffff55", "#3f3f15");
const WHITE = new MCColor("f", "WHITE", "#ffffff", "#3f3f3f");
const BOLD = new MCCode("l", "BOLD", "BOLD", "font-weight: 900;");
const STRIKETHROUGH = new MCCode("m", "STRIKETHROUGH", "STRIKE", "text-decoration: line-through;");
const UNDERLINE = new MCCode("n", "UNDERLINE", "UNDER", "text-decoration: underline;");
const ITALIC = new MCCode("o", "ITALIC", "ITALIC", "font-style: italic;");
const RESET = new MCCode("r", "RESET", "RESET", "");
const OBFUSCATED = new MCCode("k", "OBFUSCATED", "OBFUSCATED<br><span style='font-size: 0.7em; font-style: italic;'>Requires downloading Gif</span>", "");

const OBFUSCATED_CHARACTER_REPLACEMENT = [
    "¬=\\-3VmÅAºöøxçJyú$7äåîT_²ü/ñÜ8âZÑô&½ªqàgÉoé£ØóXòá+ÆESR4PLD?9BhcCvUNw#èQ·LrjëuGHYF»zÄ¿ù%6ÿnK¼Oedp1ûbæ0ÇÖsM^aW52ê«",
    "Wqß1#BGN§R4PLDMZdÞ¥Fx7S0p¿8/OzKwJh2¬CgØð9n¢µþ?s±Lc^VAQuUe=%×5T¯+H£m&r_Eo\\avYbX-3jøy6÷$"
];

const REGISTERED_CODES = [];
const COLORS = [BLACK, DARK_BLUE, DARK_GREEN, DARK_AQUA, DARK_RED, DARK_PURPLE, GOLD, GRAY, DARK_GRAY, BLUE, GREEN, AQUA, RED, LIGHT_PURPLE, YELLOW, WHITE];
const COLOR_CODES = {};
const REGISTERED_COLORS = {};
COLORS.forEach(color => {
    COLOR_CODES[color.code] = color;
    REGISTERED_COLORS[color.name] = color;
    REGISTERED_CODES.push(color.code);
});

const STYLES = [BOLD, STRIKETHROUGH, UNDERLINE, ITALIC, OBFUSCATED, RESET];
const STYLE_CODES = {};
const REGISTERED_STYLES = {};
STYLES.forEach((style, index) => {
    style.styleIndex = index;
    STYLE_CODES[style.code] = style;
    REGISTERED_STYLES[style.name] = style;
    REGISTERED_CODES.push(style.code);
});

var DEFAULT_COLOR = GRAY;
var DEFAULT_STYLES = new Array(STYLES.length - 1).fill(false);

// registering all of the characters to objects
const GLYPHS = [];
const RANDOM_INTROS = ["&cText &9Will &6Go &aHere", "&fGet &cCreative &fWith It!", "&6&lBIG &fWords &b&lGo &fHere", "&fHere's a Canvas...\n     &e&oGo &a&oPaint!"];

var canvas;

var dpi = 2;
var spacing = 2;
var backgroundColor = "#140314";
var borderColor = "#25005e";

var TOP_OFFSET = 4 * dpi + spacing;
var LEFT_OFFSET = 4 * dpi + spacing;

var FONT_SIZE = parseInt(16 * dpi * 0.5);
var LINE_HEIGHT = FONT_SIZE + dpi * 2;

// SETTINGS
var settings = new Settings();

// Overlay Toggling Stuff
var currentOverlay = "";
var previousOverlay = "";
var overlayActive = false;

var textarea;

function createButton(reminderClass, buttonText, color, textInsert) {
    var reminder = document.createElement("button");
    reminder.classList.add(reminderClass);
    reminder.innerHTML = buttonText;
    reminder.style.setProperty("--btn-color", color);

    reminder.addEventListener("click", (event) => {
        textarea.focus()
        document.execCommand("insertText", false, textInsert());
    });
    return reminder;
}

function loadColors() {  
    var colorReminder = document.getElementById("color-code-reminder");
    COLORS.forEach(color => {
        var button = createButton("code-reminder", color.code, color.color, () => {return "&" + color.code});
        if (color.code == "0") {
            button.style.setProperty("--color", "white");
        }
        colorReminder.appendChild(button);
    });

    var styleReminder = document.getElementById("formatting-codes-reminder");
    STYLES.forEach(style => {
        var text = `${style.code} : <span style="${style.style}">${style.shorthand}</span>`
        var button = createButton("code-reminder", text, "#fff", () => {return "&" + style.code});
        styleReminder.appendChild(button);
    })
}

function loadStats() {
    var statReminder = document.getElementById("stat-code-reminder");
    var createCategory = (categoryName) => {
        let category = document.createElement("div");
        category.classList.add("stat-category");
        statReminder.appendChild(category);
        
        let label = document.createElement("div");
        label.innerHTML = categoryName;
        label.classList.add("stat-category-label");
        category.appendChild(label);

        let categoryContainer = document.createElement("div");
        categoryContainer.classList.add("stat-category-container");
        category.appendChild(categoryContainer);

        return categoryContainer;
    }
    
    let categories = {};
    STATS.forEach(stat => {
        let text = `${stat.icon} ${stat.stat}`;
        let charCode = String.fromCharCode(parseInt(stat.icon.replaceAll(/[&#x;]/gm, ""), 16));
        var category = stat["category"] !== undefined ? stat.category : "Misc";
        if (categories[category] === undefined) {
            categories[category] = createCategory(category);
        }
        let statColor = REGISTERED_COLORS[stat.color];

        let button = createButton("stat-reminder", text, statColor, () => {return `&${statColor.code}${charCode} ${stat.stat}`});
        button.style.setProperty("--color", REGISTERED_COLORS[stat.color].color);

        categories[category].appendChild(button);
    });

    document.querySelectorAll(".stat-category").forEach(category => {
        var label = category.querySelector(".stat-category-label");
        label.addEventListener("click", (event) => {
            category.classList.toggle("active");
        })
    }) 
}

function loadTemplates() {
    const raritySelector = document.getElementById("template-item-rarity");
    Object.entries(RARITIES).forEach((entry) => {
        RARITIES[entry[0]]["color"] = REGISTERED_COLORS[entry[1].color];
        
        var rarityOption = document.createElement("option");
        rarityOption.value = entry[1].name;
        rarityOption.innerHTML = entry[1].name;
        raritySelector.appendChild(rarityOption);
    });

    let templateContainer = document.getElementById("template-code-reminder");
    TEMPLATES.forEach(template => {
        if ("symbol" in template) {
            template.symbol = String.fromCharCode(parseInt(template.symbol.replaceAll(/[&#x;]/gm, ""), 16));
        }

        let button = createButton("template-reminder", template.name, "#fff", () => {
            let insertText = template.description;
            var rarity = RARITIES[document.getElementById("template-item-rarity").value];
            let replacements = {
                "{rarity}": rarity.name,
                "{rarity_color}": "&" + rarity.color.code,
                "{symbol}": template.symbol != undefined ? template.symbol : ""
            }
            Object.entries(replacements).forEach(entry => {
                insertText = insertText.replaceAll(entry[0], entry[1]);
            });
            return insertText;
        });
        templateContainer.appendChild(button);
    });
}

async function loadFonts() {
    // loads the glyph sizes file from the server and makes all of the sprites
    await fetch("data/glyph_sizes.bin")
        .then(response => {
            return response.bytes();
        })
        .then(async characterWidths => {
            // calculates the number of versions of the font are specified in the file
            const fontVersionCount = Math.floor(characterWidths.length / 65536);
            for (let fontIndex = 0; fontIndex < fontVersionCount; fontIndex++) {
                let glyphSet = [];
                const GLYPH_PATH = fontIndex == 0 ? "old/" : "new/";
                let characterWidthStartIndex = fontIndex * 65536;
                // iterate over all the pages, creating a GlyphSprite for each page
                for (let glyphPage = 0; glyphPage < 256; glyphPage++) {
                    let imagePath = GLYPH_PATH + ("0" + glyphPage.toString(16)).slice(-2);
                    let sprite = new GlyphSprite(characterWidths.slice(characterWidthStartIndex, characterWidthStartIndex + 256), imagePath);
                    glyphSet[glyphPage] = sprite;
                    characterWidthStartIndex += 256;
                }
                // loads the first page (ASCII page) of the font
                await glyphSet[0].load();
                GLYPHS[fontIndex] = glyphSet;
            }
        })
}

window.addEventListener("load", async (event) => {
    // adding event listeners to all of the settings fields
    let settingInputs = document.querySelectorAll(".setting");
    settingInputs.forEach(input => {
        input.addEventListener("change", (event) => {
            if (event.target.type === "checkbox") {
                result = event.target.checked;
                
                if (event.target.getAttribute("toggle-visibility")) {
                    let targetSection = document.getElementById(event.target.getAttribute("toggle-visibility"));
                    result ? targetSection.classList.add("active") : targetSection.classList.remove("active");
                }
            }
            else if (event.target.getAttribute("option-with-custom")) {
                let colorPicker = document.getElementById(event.target.getAttribute("option-with-custom"));
                if (event.target.value != "custom") {
                    result = parseInt(event.target.value);
                    colorPicker.value = "#" + new Uint8Array([(result >> 16) & 0xff, (result >> 8) & 0xff, result & 0xff]).toHex();
                    colorPicker.disabled = true;
                } 
                else
                    colorPicker.disabled = false;
            }
            else if (event.target.type === "color")
                result = parseInt(event.target.value.replaceAll("#", ""), 16);
            else
                result = event.target.value;

            if (result !== undefined)
                settings.changeSetting(event.target.getAttribute("setting"), result);
        });

        if (input.type == "range") {
            let updateDisplay = (event) => {
                let format = event.target.getAttribute("data-format");
                document.getElementById(event.target.id + "-display").innerHTML = format.replace("%s", event.target.value);
            };

            input.addEventListener("input", updateDisplay);
            input.addEventListener("change", updateDisplay);
        }

        if (input.type === "checkbox") {
            input.checked = settings.getSetting(input.id);
        }
        else {
            input.value = settings.getSetting(input.id);
        }
        
        input.dispatchEvent(new Event("change"));
    });

    textarea = document.getElementById("generator-textarea");
    textarea.value = RANDOM_INTROS[Math.floor(Math.random() * RANDOM_INTROS.length)];
    var canvasWrapper = document.getElementById("canvas-wrapper");

    loadColors();
    loadStats();
    loadTemplates();
    await loadFonts();

    document.querySelectorAll(".overlay-btn").forEach(element => {
        var targetOverlay = element.getAttribute("data-overlay");
        if (targetOverlay == undefined) {
            return;
        }

        element.addEventListener("click", event => {
            if (currentOverlay == targetOverlay) {
                document.getElementById("icon-wrapper-collapsable").classList.remove("active");
                document.getElementById("overlays").classList.remove("active");
                document.getElementById("generator-textarea").classList.add("active");
                textarea.classList.remove("minimized-textarea");
                previousOverlay = currentOverlay;
                currentOverlay = "";
            }
            else {
                if (previousOverlay != "") {
                    document.getElementById(previousOverlay).classList.remove("active");
                    previousOverlay = "";
                }

                document.getElementById("overlays").classList.add("active");
                if (currentOverlay != "") {
                    document.getElementById(currentOverlay).classList.remove("active");
                }

                document.getElementById(targetOverlay).classList.add("active");
                currentOverlay = targetOverlay;
            }
        });
    });
    document.querySelectorAll(".menu-toggle").forEach(element => {
        element.addEventListener("click", (event) => {
            let overlayIconContainer = document.getElementById("icon-wrapper-collapsable");

            if (overlayIconContainer.classList.contains("active")) {
                textarea.classList.remove("minimized-textarea");
            } else {
                textarea.classList.add("minimized-textarea");
            }

            overlayIconContainer.classList.toggle("active");
            document.getElementById("overlays").classList.remove("active");
        });
    });

    let itemTintOptionList = document.createDocumentFragment();
    let standardOptions = [["Custom", "custom", ""], ["Default", -1, "initial"]];
    for (const standardOption of standardOptions) {
        let option = document.createElement("option");
        option.innerHTML = standardOption[0];
        option.value = standardOption[1];
        if (standardOption[2] != "") option.classList.add(standardOption[2]);
        itemTintOptionList.appendChild(option);
    }

    for (const option of Object.keys(ITEM_TINT_OPTIONS)) {
        let allOptions = ITEM_TINT_OPTIONS[option];
        let category = document.createElement("div");
        category.setAttribute("category", option);
        
        let optionNames = Object.keys(allOptions);
        for (const name of optionNames) {
            let element = document.createElement("option");
            element.innerHTML = name;
            element.value = allOptions[name];
            category.appendChild(element);
        }

        itemTintOptionList.appendChild(category);
    }
    
    document.querySelectorAll(".option-color-select").forEach(element => {
        element.appendChild(itemTintOptionList.cloneNode(true)); 
    });
    document.querySelectorAll(".searchable").forEach(element => {
        let dropdownArea = element.querySelector(".relevant-items-content");
        let searchBar = element.querySelector(".searchable-input");
        
        let onArrowDirection = (direction) => {
            if (selectedIndex != -1) {
                recyclerElements[selectedIndex].classList.remove("selected");
            }

            selectedIndex += direction;
            selectedIndex = Math.max(Math.min(selectedIndex, activeElements), 1);
            recyclerElements[selectedIndex].classList.add("selected");
            recyclerElements[selectedIndex].scrollIntoView({block: "nearest"});
        }

        let tintColorSelectors = document.querySelectorAll(".tint-color-selector");
        let onSelect = (targetItem) => {
            let targetItemModel = targetItem.replaceAll(" ", "_").toLowerCase();
            if (!modelInformation[targetItemModel]) {
                throw new Error("Couldn't find the requested item");
            }

            searchBar.value = targetItem;
            document.activeElement.blur();
            canvas.blockRenderer.setItem(targetItemModel);

            let headRenderingSettings = document.getElementById("head-generator-settings");
            let index = 0;
            if (targetItemModel == "player_head") {
                headRenderingSettings.classList.add("active");
            } else {
                headRenderingSettings.classList.remove("active");

                let foundTints = modelInformation[targetItemModel]?.tints ?? [];
                let tints = [];
                Object.values(foundTints).forEach((element) => {
                    tints.push(element?.value ?? element?.default ?? 8174955);
                    tintColorSelectors[index].classList.add("active");
                    
                    let categories = tintColorSelectors[index].querySelectorAll("div");
                    for (let i = 0; i < categories.length; i++) {
                        categories[i].style.display = categories[i].getAttribute("category") == element.type ? "block" : "none";
                    }
                    tintColorSelectors[index].querySelector(".initial").value = tints[index];
                    tintColorSelectors[index].querySelector("select").value = tints[index];
                    tintColorSelectors[index].querySelector("input[type='color']").value = "#" + new Uint8Array([(tints[index] >> 16) & 0xff, (tints[index] >> 8) & 0xff, tints[index] & 0xff]).toHex();
                    index++;
                });
                canvas.blockRenderer.setTint(tints);
            }
            
            for (; index < tintColorSelectors.length; index++) {
                tintColorSelectors[index].classList.remove("active");
            }
        }

        let elementCount = 10;
        let selectedIndex = -1;
        let activeElements = 0;
        let recyclerElements = [];
        for (let i = 0; i <= elementCount; i++) {
            let listElement = document.createElement("button");
            listElement.classList.add("searchable-item", "hidden");
            if (i > 0) {
                listElement.addEventListener("click", (event) => {
                    if (event.target.getAttribute("target-item"))
                        onSelect(event.target.getAttribute("target-item"));
                });
            }
            dropdownArea.appendChild(listElement);
            recyclerElements.push(listElement);
        }

        recyclerElements[0].innerHTML = "No matches...";
        recyclerElements[0].classList.remove("hidden");

        searchBar.addEventListener("keydown", (event) => {
            if (event.code == "ArrowDown") {
                event.preventDefault();
                onArrowDirection(1)
            }
            else if (event.code == "ArrowUp") {
                event.preventDefault();
                onArrowDirection(-1);
            }
            else if (event.code == "Enter") {
                if (activeElements == 1)
                    selectedIndex = 1;
                else if (selectedIndex < 0)
                    return;
                
                let targettedElement = recyclerElements[selectedIndex].getAttribute("target-item");
                if (targettedElement) {
                    recyclerElements[selectedIndex].click();
                }
            }
        });
        searchBar.addEventListener("input", (event) => {
            let word = event.target.value.toLowerCase();
            if (!itemInformation[word.charAt(0)]) {
                recyclerElements[0].classList.remove("hidden");
                for (let i = 1; i <= elementCount; i++) {
                    recyclerElements[i].classList.add("hidden");
                }
                return;
            }

            recyclerElements[0].classList.add("hidden");
            let items = itemInformation[word.charAt(0)];
            let wordIndex = 0;
            let elementIndex = 1;
            let regex = new RegExp(`(${word.toLowerCase()})`, "i");
            selectedIndex = 0;
            activeElements = 0;
            while (elementIndex < elementCount && wordIndex < items.length) {
                if (regex.test(items[wordIndex])) {
                    recyclerElements[elementIndex].innerHTML = items[wordIndex];
                    recyclerElements[elementIndex].setAttribute("target-item", items[wordIndex])
                    recyclerElements[elementIndex].classList.remove("hidden", "selected");
                    elementIndex++;
                    activeElements++;
                }
                wordIndex++;
            }

            if (elementIndex == 1) {
                selectedIndex = -1;
                recyclerElements[0].classList.remove("hidden");
            }
            for (; elementIndex < elementCount; elementIndex++) {
                recyclerElements[elementIndex].classList.add("hidden");
            }
        });
    });

    document.getElementById("skin-loading-type").addEventListener("change", (event) => {
        let elements = document.getElementsByClassName("head-generator-setting");
        for (let i = 0; i < elements.length; i++) {
            elements[i].classList.remove("active");
        }
        document.getElementById(event.target.value).classList.add("active");
    });

    document.querySelectorAll(".click-toggleable").forEach(element => {
        element.addEventListener("click", () => {
            document.getElementById(element.getAttribute("target")).classList.toggle("active");
        });
    });

    canvas = new MinecraftGenerator(canvasWrapper, textarea, settings);
    document.getElementById("display-item-settings").appendChild(canvas.blockRenderer.canvas);
    document.getElementById("file-skin-setting").addEventListener("change", (event) => {
        if (event.target.files.length < 1) {
            console.error("Please select a file!");
            return;
        }

        canvas.blockRenderer.setSkinTexture(URL.createObjectURL(event.target.files[0]));
    });
    document.getElementById("skin-url-input").addEventListener("change", (event) => {
        canvas.blockRenderer.setSkinTexture(event.target.value);
    });
    document.getElementById("skin-base64-input").addEventListener("change", (event) => {
        canvas.blockRenderer.setBase64SkinTexture(event.target.value);
    });
    
    await canvas.redrawImage();
});

function copyToClipboard() {
    canvas.copyToClipboard();
}

function downloadImage() {
    const lines = textarea.value.split("\n", 2);
    let itemName = lines.length > 1 ? lines[0].replaceAll(/[#%&{}<>*?\/$!'":@+`|= ]/g, "") : "GeneratedItem"; 
    canvas.downloadImage(itemName);
}