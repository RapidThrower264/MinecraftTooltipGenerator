class GifEncoder {
    static EXTENSION_INTRODUCER = 33;       // 0x21
    static EXTENSION_END = 0;               // 0x00
    static GRAPHIC_EXTENSION = 249;         // 0xf9
    static COMMENT_EXTENSION = 254;         // 0xfe
    static APPLICATION_EXTENSION = 255;     // 0xff
    static IMAGE_SEPARATOR = 44;            // 0x2c
    static END_BLOCK = 0;                   // 0x00
    static COLOR_TABLE_RESET = 4090;        // Close to 2**12

    static FILE_DOUBLING_LIMIT = 1024 * 1024;

    constructor() {}

    writeByte(byteData) {
        if (this.pointer >= this.stream.length) {
            let newLength = this.stream.length * (this.stream.length > GifEncoder.FILE_DOUBLING_LIMIT ? 2 : 1.5);
            let newStream = new Uint8Array(newLength);
            newStream.set(this.stream, 0);
            this.stream = newStream;
        }

        this.stream[this.pointer++] = byteData;
    }

    writeCharacterBytes(string) {
        for (var i = 0; i < string.length; i++) {
            this.stream[this.pointer++] = string.charCodeAt(i);
        }
    }

    writeUInt(data) {
        this.stream[this.pointer++] = data & 0xff;
        this.stream[this.pointer++] = (data >> 8) & 0xff;
    }

    createImage(renderer, delay) {
        this.stream = new Uint8Array((renderer.canvasWidth * renderer.canvasHeight) / 4);
        this.pointer = 0;

        renderer.initialiseGif();
        
        const colors = renderer.imageColors;
        this._createHeader(renderer.canvasWidth, renderer.canvasHeight, colors.size);
        const colorMap = this._createGlobalTable(colors);
        const minCodeSize = Math.ceil(Math.log2(colorMap.size));
        this._createApplicationExtension();

        this._createComment("Gif created using the Minecraft Tooltip Generator by RapidThrower264");
        this._createGraphicsExtension(delay);
        this._createImagePage(renderer.getBaseFrame(), 0, 0, colorMap, minCodeSize);
        let frameGenerator = renderer.frameGenerator();
        for (let i = 0; i < 20; i++) {
            this._createGraphicsExtension(delay);
            let [frameData, x, y] = frameGenerator.next().value;
            this._createImagePage(frameData, x, y, colorMap, minCodeSize);
        }
        this._closeImage();
        this._optimizeImage();
    }

    _createHeader(imageWidth, imageHeight, requiredColors) {
        this.writeCharacterBytes("GIF89a");
        this.writeUInt(imageWidth);
        this.writeUInt(imageHeight);
        // writes default flags for transparency and sorting, and dynamic for the colors available;
        this.writeByte(240 + Math.ceil(Math.log2(requiredColors) - 1));
        this.writeByte(0); // sets the background color to the first value.
        this.writeByte(0); // sets the pixel aspect ratio
    }

    _createGlobalTable(colors) {
        const colorMap = new Map();
        colorMap.set("-1", 0);
        colors.delete("transparent");

        this.pointer += 3;
        let colorIndex = 1;

        // adding the colors to the buffer
        for (let color of colors) {
            color = color.substring(1);
            colorMap.set((parseInt(color, 16)).toString(), colorIndex++);
            color.match(/.{2}/g).forEach(channel => this.writeByte(parseInt(channel, 16)));
        };

        // skipping the bytes forward for any unused colors
        this.pointer += (2 ** (Math.ceil(Math.log2(colors.size + 1))) - colors.size - 1) * 3;

        return colorMap;
    }

    _createApplicationExtension() {
        this.writeByte(GifEncoder.EXTENSION_INTRODUCER);
        this.writeByte(GifEncoder.APPLICATION_EXTENSION);
        this.writeByte(11);
        this.writeCharacterBytes("NETSCAPE2.0");
        this.writeByte(3);
        this.writeByte(1);
        this.writeUInt(0);  // setting the number of repetitions
        this.writeByte(GifEncoder.EXTENSION_END);
    }

    _createGraphicsExtension(delay) {
        this.writeByte(GifEncoder.EXTENSION_INTRODUCER);
        this.writeByte(GifEncoder.GRAPHIC_EXTENSION);
        this.writeByte(4);
        this.writeByte(5) // 00000101
        this.writeUInt(delay);  // delay time
        this.writeByte(0);  // transparent color index
        this.writeByte(GifEncoder.END_BLOCK);
    }

    _createComment(comment) {
        if (comment.length > 255) {
            console.warn("Comment length should be at maximum of 255 characters")
        }

        this.writeByte(GifEncoder.EXTENSION_INTRODUCER);
        this.writeByte(GifEncoder.COMMENT_EXTENSION);
        this.writeByte(comment.length);
        this.writeCharacterBytes(comment);
        this.writeByte(0);
    }

    _createImagePage(imageData, x, y, colorMap, minCodeSize) {
        this._createImageDescriptor(x, y, imageData.width, imageData.height);
        this._createImageData(imageData.data, colorMap, minCodeSize);
    }

    _createImageDescriptor(x, y, width, height) {
        this.writeByte(GifEncoder.IMAGE_SEPARATOR);
        this.writeUInt(x);
        this.writeUInt(y);
        this.writeUInt(width);
        this.writeUInt(height);
        this.writeByte(0); // 00000000
    }

    _createImageData(imageData, colorMap, minCodeSize) {
        let lwzCodes = new Array(200300);
        let lwzPointer = 0;
        lwzCodes[lwzPointer++] = (1 << minCodeSize)
        
        // compressing into data
        let requiredBits = minCodeSize + 1;
        let nextCode = (1 << minCodeSize) + 2;
        let targetPixel = 0;

        let colorTable = new Map(colorMap);
        let buffer = (imageData[targetPixel + 3] == 0 ? -1 : (imageData[targetPixel] << 16) + (imageData[targetPixel + 1] << 8) + imageData[targetPixel + 2]).toString();
        targetPixel += 4;

        while (targetPixel < imageData.length) {
            let nextElement = (imageData[targetPixel + 3] == 0 ? -1 : (imageData[targetPixel] << 16) + (imageData[targetPixel + 1] << 8) + imageData[targetPixel + 2]).toString();
            targetPixel += 4;

            if (colorTable.has(`${buffer},${nextElement}`)) {
                buffer += "," + nextElement;
            } else {
                colorTable.set(`${buffer},${nextElement}`, nextCode++);
                // adding data into the stream
                lwzCodes[lwzPointer++] = colorTable.get(buffer);
                // increasing the code size if the next bit is being added to the buffer
                if (nextCode > GifEncoder.COLOR_TABLE_RESET) {
                    colorTable = new Map(colorMap);
                    lwzCodes[lwzPointer++] = (1 << minCodeSize);
                    nextCode = (1 << minCodeSize) + 2;
                    requiredBits = minCodeSize + 1;
                }

                buffer = nextElement;
            }
        }
        lwzCodes[lwzPointer++] = colorTable.get(buffer);
        lwzCodes[lwzPointer++] = (1 << minCodeSize) + 1;

        let writeToBuffer = (bits) => {
            while (bitsStored > bits) {
                if (bytesInBlock > 253) {
                    this.stream[targetBlockByte] = bytesInBlock;
                    bytesInBlock = 0;
                    targetBlockByte = this.pointer++;
                }
                this.writeByte(encodedBuffer & 255);
                encodedBuffer >>= 8;
                bitsStored -= 8;
                bytesInBlock++;
            }
        }

        // bit packing and writing into the final stream
        this.writeByte(minCodeSize);
        let bitsRequired = minCodeSize + 1;
        let currentCode = (1 << minCodeSize) + 1;

        let i = 0;
        let encodedBuffer = 0;
        let bitsStored = 0;

        let bytesInBlock = 0;
        let targetBlockByte = this.pointer++;

        while (i < lwzPointer) {
            encodedBuffer |= (lwzCodes[i++] << bitsStored);
            bitsStored += bitsRequired;

            if (((currentCode) & (currentCode - 1)) == 0) {
                bitsRequired++;
            }
            else if (currentCode > GifEncoder.COLOR_TABLE_RESET) {
                bitsRequired = minCodeSize + 1;
                currentCode = (1 << minCodeSize) + 1;
            }

            currentCode += 1;
            writeToBuffer(7);
        }

        writeToBuffer(0);
        this.stream[targetBlockByte] = bytesInBlock;
        this.writeByte(0);
    }

    _closeImage() {
        this.writeByte(59); // end of file
    }

    _optimizeImage() {
        this.stream = this.stream.slice(0, this.pointer + 1);
    }
}