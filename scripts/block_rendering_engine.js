class Point {
    // A point within the 3d space.
    constructor(matrix, u, v) {
        this.matrix = [matrix[0], matrix[1], matrix[2]];
        this.u = u;
        this.v = v;
    }

    get x() {
        return this.matrix[0];
    }

    set x(value) {
        this.matrix[0] = value;
    }

    get y() {
        return this.matrix[1];
    }

    set y(value) {
        this.matrix[1] = value;
    }

    get z() {
        return this.matrix[2];
    }

    set z(value) {
        this.matrix[2] = value;
    }

    toString() {
        return `x: ${this.x}<br/>y: ${this.y}<br/>u: ${this.u}<br/>v: ${this.v}<br/>`
    }
}

class Triangle {
    // A triangle that exists within a 3d space.
    constructor(trianglePoints) {
        this.points = trianglePoints;
    }

    calculateNormal() {
        let lineA = [this.points[1].x - this.points[0].x, this.points[1].y - this.points[0].y, this.points[1].z - this.points[0].z];
        let lineB = [this.points[2].x - this.points[0].x, this.points[2].y - this.points[0].y, this.points[2].z - this.points[0].z];

        let normal = [
            lineA[1] * lineB[2] - lineA[2] * lineB[1], 
            lineA[2] * lineB[0] - lineA[0] * lineB[2],
            lineA[0] * lineB[1] - lineA[1] * lineB[0],
        ];

        let length = Math.sqrt(normal[0] * normal[0] + normal[1] * normal[1] + normal[2] * normal[2]);
        normal[0] /= length;
        normal[1] /= length;
        normal[2] /= length;
        return normal;
    }

    get a() {
        return this.points[0];
    }

    get b() {
        return this.points[1];
    }

    get c() {
        return this.points[2];
    }

    setUVCoordinates(uvCoordinates, uvMap) {
        uvMap = uvMap != null ? uvMap.map(value => value / 16) : [0, 0, 1, 1];
        for (let i = 0; i < 3; i++) {
            this.points[i].u = uvCoordinates[i * 2] == 0 ? uvMap[0] : uvMap[2];
            this.points[i].v = uvCoordinates[i * 2 + 1] == 0 ? uvMap[1] : uvMap[3];
        }
    }
}

class Texture {
    // A texture for a block or item
    constructor(name, x, y, width, height, image, tint) {
        this.name = name;
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.image = image;

        if (tint !== undefined) {
            let r = (tint >> 16) & 0xFF;
            let g = (tint >> 8) & 0xFF;
            let b = tint & 0xFF;
            for (let i = 0; i < image.length; i += 4) {
                image[i] = ((image[i] / 255) * r) | 0;
                image[i + 1] = ((image[i + 1] / 255) * g) | 0;
                image[i + 2] = ((image[i + 2] / 255) * b) | 0;
            }
        }
    }

    sampleTexture(u, v) {
        let textureCoordinate = (((Math.min(u, 0.999) * this.width) | 0) + ((Math.min(v, 0.999) * this.height) | 0) * this.width) * 4;
        return this.image.slice(textureCoordinate, textureCoordinate + 4);
    }
}

class TextureManager {
    // Manages the textures and models for the renderer
    constructor(spritesheetImage, skinImage, customTextureImage, enchantmentGlintImage) {
        this.targetImage = spritesheetImage;
        this.width = this.targetImage.width;
        this.height = this.targetImage.height;
        this.textureCanvas = document.createElement("canvas");
        this.textureCanvas.width = this.width;
        this.textureCanvas.height = this.height;
        this.ctx = this.textureCanvas.getContext("2d", {"willReadFrequently": true});
        this.ctx.drawImage(this.targetImage, 0, 0);

        this.skinCanvas = document.createElement("canvas");
        this.skinCanvas.width = 64;
        this.skinCanvas.height = 64;
        this.skinCTX = this.skinCanvas.getContext("2d", {"willReadFrequently": true});
        this.skinImage = skinImage;
        this.skinImage.addEventListener("load", () => {
            this.skinCTX.clearRect(0, 0, 64, 64);
            this.skinCTX.drawImage(this.skinImage, 0, 0);
        });
        this.skinCTX.drawImage(this.skinImage, 0, 0);

        this.customCanvas = document.createElement("canvas");
        this.customCTX = this.customCanvas.getContext("2d", {"willReadFrequently": true});
        this.customTexture = customTextureImage;
        this.customTexture.addEventListener("load", () => {
            // drawing the image so that it is a square
            let size = Math.max(this.customTexture.naturalWidth, this.customTexture.naturalHeight);
            let xCenterOffset = Math.floor(size / 2 - this.customTexture.naturalWidth / 2);
            let yCenterOffset = Math.floor(size / 2 - this.customTexture.naturalHeight / 2);
            this.customCanvas.width = size;
            this.customCanvas.height = size;
            
            this.customCTX.drawImage(this.customTexture, xCenterOffset, yCenterOffset);
        });
        this.customTexture.dispatchEvent(new Event("load"));

        this.enchantGlintCanvas = document.createElement("canvas");
        this.enchantGlintSize = 128;
        this.enchantGlintCanvas.width = this.enchantGlintSize;
        this.enchantGlintCanvas.height = this.enchantGlintSize;
        this.enchantCTX = this.enchantGlintCanvas.getContext("2d", {"willReadFrequently": true});
        this.enchantCTX.imageSmoothingEnabled = false;
        this.enchantmentGlintImage = enchantmentGlintImage;
    }

    deepMergeReverse(target, source) {
        // merges two objects, taking the data from the source if it is present.
        if (typeof source === 'object' && source !== null) {
            for (const key in source) {
                if (key in target) {
                    this.deepMergeReverse(target[key], source[key]);
                }
                else {
                    target[key] = source[key];
                }
            }
        }

        return target;
    }

    getModel(itemName) {
        // retrieves a model for rendering
        let model = structuredClone(modelInformation[itemName]);
        let targetModel = model.parent;

        while (targetModel != null) {
            let tempModel = structuredClone(modelInformation[targetModel]);
            model = this.deepMergeReverse(model, tempModel);
            targetModel = tempModel.parent != targetModel ? tempModel.parent : null;
        }
    
        return model;
    }

    getTexture(textureName, tint, enchant) {
        // gets the texture data for a particular model
        let texture = spritesheet[textureName];
        let imageData, textureSize;
        if (texture["skin"]) {
            textureSize = 8;
            imageData = this.skinCTX.getImageData(texture.x, texture.y, textureSize, textureSize).data;
        } else if (enchant) {
            textureSize = this.enchantGlintSize;
            imageData = this.applyEnchantLayer(this.textureCanvas, texture.x, texture.y, 16).data;
        } else {
            textureSize = 16;
            imageData = this.ctx.getImageData(texture.x, texture.y, textureSize, textureSize).data;
        }
        
        return new Texture("", texture.x, texture.y, textureSize, textureSize, imageData, tint);
    }

    getCustomTexture(tint) {
        return new Texture("", 0, 0, this.customCanvas.width, this.customCanvas.height, this.customCTX.getImageData(0, 0, this.customCanvas.width, this.customCanvas.height).data, tint);
    }

    applyEnchantLayer(canvas, x, y, size) {
        this.enchantCTX.globalCompositeOperation = "source-over";
        this.enchantCTX.globalAlpha = 1;
        this.enchantCTX.drawImage(canvas, x, y, size, size, 0, 0, this.enchantGlintSize, this.enchantGlintSize);

        this.enchantCTX.globalCompositeOperation = "screen";
        this.enchantCTX.globalAlpha = 0.776;
        this.enchantCTX.drawImage(this.enchantmentGlintImage, 0, 0, this.enchantGlintSize, this.enchantGlintSize, 0, 0, 1024, 1024);

        this.enchantCTX.globalAlpha = 1;
        this.enchantCTX.globalCompositeOperation = "destination-in";
        this.enchantCTX.drawImage(canvas, x, y, size, size, 0, 0, this.enchantGlintSize, this.enchantGlintSize);
        return this.enchantCTX.getImageData(0, 0, this.enchantGlintSize, this.enchantGlintSize);
    }

    setObjectURL(objectURL) {
        this.skinImage.src = objectURL;
    }

    setCustomTextureURL(objectURL) {
        this.customTexture.src = objectURL;
    }
}

class BlockRenderingEngine {
    // the main renderer for blocks and items
    static cubeFaces = [
        [2, 1, 3, 0, "north", 0, 1],
        [5, 6, 4, 7, "south", 0, 1],
        [1, 5, 0, 4, "west", 2, 1],
        [6, 2, 7, 3, "east", 2, 1],
        [1, 2, 5, 6, "up", 0, 2],
        [4, 7, 0, 3, "down", 0, 2]
    ]

    constructor(width, height, spritesheetImage, skinImage, customTextureImage, enchantmentGlintImage) {
        this.canvas = document.createElement("canvas");
        this.ctx = this.canvas.getContext("2d", {"willReadFrequently": true});
        this.defaultWidth = width;
        this.defaultHeight = height;
        this.setSize(width, height);
        this.setAntiAliasing(this.ctx);
        
        this.isValid = false;
        this.data = null;
        this.zBuffer = null;
        this.textureManager = new TextureManager(spritesheetImage, skinImage, customTextureImage, enchantmentGlintImage);
        skinImage.addEventListener("load", () => this.isValid = false);
        skinImage.crossOrigin = "Anonymous";
        customTextureImage.addEventListener("load", () => this.isValid = false);
        customTextureImage.crossOrigin = "Anonymous";

        this.modelName = null;
        this.tint = [];
        this.isEnchanted = false;
    }

    setSize(width, height) {
        this.width = width;
        this.height = height;
        this.canvas.width = width;
        this.canvas.height = height;
        this.canvas.style.imageRendering = "pixelated";
    }

    setAntiAliasing(context) {
        // disables anti aliasing for the context
        context.mozImageSmoothingEnabled = false;
        context.oImageSmoothingEnabled = false;
        context.webkitImageSmoothingEnabled = false;
        context.msImageSmoothingEnabled = false;
    }

    toScreenPosition(point) {
        // converts an existing point from world space into screen space
        let result = new Point(point.matrix, point.u, point.v);
        result.x = point.x * this.width + this.width / 2;
        result.y = -point.y * this.height + this.height / 2;
        return result;
    }

    multiplyMatrix(a, b) {
        // multiplies two matricies together
        let rowRange = a.length;
        let result = new Array(rowRange);
        for (let y = 0; y < rowRange; y++) {
            let value = 0;
            for (let x = 0; x < rowRange; x++) {
                value += b[x] * a[y][x];
            }
            result[y] = value;
        }

        return result;
    }

    calculateRotationMatrix(point, c, b, a) {
        // rotates a given point around the three axes
        let matrix = this.multiplyMatrix([[Math.cos(a), -Math.sin(a), 0], [Math.sin(a), Math.cos(a), 0], [0, 0, 1]], point);
        matrix = this.multiplyMatrix([[Math.cos(b), 0, Math.sin(b)], [0, 1, 0], [-Math.sin(b), 0, Math.cos(b)]], matrix);
        matrix = this.multiplyMatrix([[1, 0, 0], [0, Math.cos(c), -Math.sin(c)], [0, Math.sin(c), Math.cos(c)]], matrix);
        return matrix;
    }

    drawTriangle(renderTriangle, texture, shadow) {
        // wrapper function for drawing a full triangle to the screen, breaking it down into two smaller triangles with flat edges
        let points = renderTriangle.points.map(point => this.toScreenPosition(point));
        points.sort((a, b) => { return a.y - b.y });
        if(((points[2].y - points[0].y) | 0) == 0) {
            return;
        }

        let midPercentage = (points[1].y - points[0].y) / (points[2].y - points[0].y);
        let midpoint = new Point(
            [midPercentage * (points[2].x - points[0].x) + points[0].x, 
            points[1].y, 
            midPercentage * (points[2].z - points[0].z) + points[0].z],
            midPercentage * (points[2].u - points[0].u) + points[0].u,
            midPercentage * (points[2].v - points[0].v) + points[0].v
        );

        let middlePoints = [points[1], midpoint];
        middlePoints.sort((a, b) => { return a.x - b.x });
        this.drawMiniTriangle(points[0], middlePoints[0], middlePoints[1], false, texture, shadow);
        this.drawMiniTriangle(points[2], middlePoints[0], middlePoints[1], true, texture, shadow);
    }

    drawMiniTriangle(a, b, c, useFlatSide, texture, shadow) {
        // renders a triangle to the screen using the standard rasterizatation algorithm
        if (Math.abs(b.y - a.y) < 1 || Math.abs(c.y - a.y) < 1) {
            return;
        }

        let dAX = (b.x - a.x) / (b.y - a.y);
        let dAZ = (b.z - a.z) / (b.y - a.y);
        let dAU = (b.u - a.u) / (b.y - a.y);
        let dAV = (b.v - a.v) / (b.y - a.y);

        let dBX = (c.x - a.x) / (c.y - a.y);
        let dBZ = (c.z - a.z) / (c.y - a.y);
        let dBU = (c.u - a.u) / (c.y - a.y);
        let dBV = (c.v - a.v) / (c.y - a.y);

        let aLine, bLine;
        if (useFlatSide) {
            aLine = [b.x, b.u, b.v, b.z];
            bLine = [c.x, c.u, c.v, c.z];
        } else {
            aLine = [a.x, a.u, a.v, a.z];
            bLine = [a.x, a.u, a.v, a.z];
        }

        let target = Math.ceil(useFlatSide ? a.y : b.y);
        let triangleY = 0;
        for (let y = Math.floor(useFlatSide ? b.y : a.y); y < target; y++) {
            let aX = Math.round(aLine[0] + dAX * triangleY);
            let aZ = aLine[3] + dAZ * triangleY;
            let aU = aLine[1] + dAU * triangleY;
            let aV = aLine[2] + dAV * triangleY;
            let bX = bLine[0] + dBX * triangleY;
            
            let dx = bX - aX;
            let dz = ((bLine[3] + dBZ * triangleY) - aZ) / dx;
            let du = ((bLine[1] + dBU * triangleY) - aU) / dx;
            let dv = ((bLine[2] + dBV * triangleY) - aV) / dx;

            let u = aU;
            let v = aV;
            let z = aZ;

            let start = 0; 
            for (let x = Math.round(aX); x < bX | 0; x++) {
                let pixelColor = texture.sampleTexture(u, v);
                let pixelCoord = (y * this.width + x) * 4;

                if (z > this.zBuffer[(y * this.width + x)] && pixelColor[3] > 0) {
                    this.data[pixelCoord] = pixelColor[0] * shadow;
                    this.data[pixelCoord + 1] = pixelColor[1] * shadow;
                    this.data[pixelCoord + 2] = pixelColor[2] * shadow;
                    this.data[pixelCoord + 3] = pixelColor[3];

                    this.zBuffer[(y * this.width + x)] = z;
                }

                start += 1;
                z = aZ + dz * start;
                u = aU + du * start;
                v = aV + dv * start;
            }
            triangleY += 1;
        }
    }

    drawImage(texture) {
        let data = texture.image;
        let length = data.length;
        for (let i = 0; i < length; i++) {
            if (data[i] != 0)
                this.targetData[i] = data[i];
        }
    }

    render() {
        if (this.isValid)
            return;

        if (this.modelName == null) {
            this.isValid = true;
            return;
        }

        // renders the given model to the screen
        this.ctx.clearRect(0, 0, this.width, this.height);

        let model = this.textureManager.getModel(this.modelName);
        if (this.modelName == "custom")
            this.renderImage(this.tint[0], this.isEnchanted);
        else if (model["elements"])
            this.renderBlock(model, this.tint, this.isEnchanted);
        else
            this.renderGenerated(model, this.tint, this.isEnchanted);

        this.isValid = true;
    }

    renderBlock(model, tints, isEnchanted) {
        this.setSize(this.defaultWidth, this.defaultHeight);

        // renders a block to the screen
        this.zBuffer = new Float64Array(this.width * this.height).fill(-653000);
        let imageData = this.ctx.getImageData(0, 0, this.width, this.height);
        this.data = imageData.data;

        let scale = model?.display?.gui?.scale?.[0] ?? 0.625;
        let rotation = model?.display?.gui?.rotation?.map(value => value * Math.PI / 180) ?? [Math.PI / 6, 5 * Math.PI / 4, 0];
        let translation = model?.display?.gui?.translation.map(value => value != 0 ? Math.sign(value) * (Math.abs(value) + 1) / 16 : 0) ?? [0, 0, 0];
        for (let element = model.elements.length - 1; element >= 0; element--) {
            let modelData = model.elements[element];
            let cubePoints = [[-1, -1, -1], [-1, 1, -1], [1, 1, -1], [1, -1, -1], [-1, -1, 1], [-1, 1, 1], [1, 1, 1], [1, -1, 1]]

            // create the points for the model, centering the points around (0, 0) in world space.
            let calculatedPoints = new Array(cubePoints.length);
            for (let i = 0; i < 8; i++) {
                let location = cubePoints[i].map((point, index) => ((point == -1 ? modelData.from[index] : modelData.to[index]) / 16 - 0.5)  * scale);
                location[0] += translation[0];
                location[1] += translation[1];
                location[2] += translation[2];
                calculatedPoints[i] = new Point(this.calculateRotationMatrix(location, rotation[0], rotation[1], rotation[2]));
            }

            for (const face of BlockRenderingEngine.cubeFaces) {
                let upperTriangle = new Triangle([calculatedPoints[face[0]], calculatedPoints[face[1]], calculatedPoints[face[2]]]);
                let lowerTriangle = new Triangle([calculatedPoints[face[1]], calculatedPoints[face[2]], calculatedPoints[face[3]]]);
                
                let normal = upperTriangle.calculateNormal();
                if ((normal[2] < 0 && modelData.faces[face[4]]) || modelData["force_render"]) {
                    let shadowMultiplier = normal[1] < 0 ? 1 : (normal[0] > 0 ? 0.65 : 0.4);
                    let modelFace = modelData.faces[face[4]];
                    let targetTexture = modelFace.texture;
                    while (targetTexture.includes("#"))
                        targetTexture = model.textures[targetTexture.replaceAll("#", "")];
                    let texture = this.textureManager.getTexture(targetTexture, modelFace?.tintindex > -1 ? tints[modelFace.tintindex] : undefined, isEnchanted);
                    
                    if (!modelFace.uv)
                        modelFace.uv = [modelData.from[face[5]], modelData.from[face[6]], modelData.to[face[5]], modelData.to[face[6]]];
                    upperTriangle.setUVCoordinates([0, 0, 1, 0, 0, 1], modelFace.uv);
                    this.drawTriangle(upperTriangle, texture, shadowMultiplier);
                    lowerTriangle.setUVCoordinates([1, 0, 0, 1, 1, 1], modelFace.uv);
                    this.drawTriangle(lowerTriangle, texture, shadowMultiplier);
                }
            }
        }

        this.ctx.putImageData(imageData, 0, 0);
    }

    renderGenerated(model, tints, isEnchanted) {
        this.setSize(16, 16);
        this.targetData = new Uint8ClampedArray(4 * this.width * this.height);

        // renders an item to the screen.
        let layer = 0;
        let layers = Object.values(model.textures);
        let layeredTints = tints ?? [];
        for (; layer < layers.length; layer++) {
            let tint = layeredTints[layer] ?? undefined;
            this.drawImage(this.textureManager.getTexture(layers[layer], tint));
        }
        this.ctx.putImageData(new ImageData(this.targetData, this.width, this.height), 0, 0);     

        if (isEnchanted) {
            let imageData = this.textureManager.applyEnchantLayer(this.canvas, 0, 0, this.width);
            this.setSize(imageData.width, imageData.height);
            this.ctx.putImageData(imageData, 0, 0);
        }
    }

    renderImage(tint, isEnchanted) {
        let texture = this.textureManager.getCustomTexture(tint);

        this.setSize(texture.width, texture.height);
        this.targetData = new Uint8ClampedArray(4 * this.width * this.height);

        // renders an item to the screen.
        this.drawImage(texture);
        this.ctx.putImageData(new ImageData(this.targetData, this.width, this.height), 0, 0);

        if (isEnchanted) {
            let imageData = this.textureManager.applyEnchantLayer(this.canvas, 0, 0, this.width);
            this.setSize(imageData.width, imageData.height);
            this.ctx.putImageData(imageData, 0, 0);
        }
    }

    setItem(modelName) {
        if (this.modelName != modelName) {
            this.modelName = modelName;
            this.isValid = false;
        }
    }

    setTint(tint) {
        if (JSON.stringify(this.tint) != JSON.stringify(tint)) {
            this.tint = tint;
            this.isValid = false;
        }
    }
    
    setTintLayer(tint, layer) {
        this.tint[layer] = tint;
        this.isValid = false;
    }

    setSkinTexture(objectURL) {
        this.textureManager.setObjectURL(objectURL);
        this.isValid = false;
    }

    setCustomItemTexture(objectURL) {
        this.textureManager.setCustomTextureURL(objectURL);
        this.model = "custom";
    }

    setEnchanted(isEnchanted) {
        this.isEnchanted = isEnchanted;
        this.isValid = false;
    }

    setBase64SkinTexture(base64String) {
        let skinData = JSON.parse(window.atob(base64String));
        let url = skinData?.textures?.SKIN?.url ?? undefined;
        if (url == undefined) {
            throw new Error("Could not find the skin!", { details: `Skin data provided: ${base64String}, Parsed Data: ${skinData}`});
        } else {
            this.setSkinTexture(url);
        }
    }
}