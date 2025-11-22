class CNNTrainer {
    constructor() {
        this.model = null;
        this.isTrained = false;
        this.trainingHistory = null;
        this.classNames = [];
    }

    async train(dataset, onProgress = null) {
        try {
            console.log('Starting SIMPLE CNN training...');
            
            if (!dataset || !dataset.images || dataset.images.length === 0) {
                throw new Error('No training data available');
            }

            const numClasses = Math.max(...dataset.labels) + 1;
            
            // VERY SIMPLE MODEL - No complex layers
            this.model = tf.sequential({
                layers: [
                    tf.layers.flatten({ inputShape: [32, 32, 3] }),
                    tf.layers.dense({ units: 64, activation: 'relu' }),
                    // tf.layers.dropout({ rate: 0.5 }),
                    tf.layers.dense({ units: numClasses, activation: 'softmax' })
                ]
            });

            this.model.compile({
                optimizer: 'adam',
                loss: 'categoricalCrossentropy',
                metrics: ['accuracy']
            });

            // Simple image preprocessing
            const { images, labels } = await this.prepareData(dataset, onProgress);
            
            // Quick training
            const history = await this.model.fit(images, labels, {
                epochs: 15,
                batchSize: 8,
                validationSplit: 0.2,
                callbacks: {
                    onEpochEnd: (epoch, logs) => {
                        if (onProgress) {
                            const progress = 50 + ((epoch + 1) / 15 * 50);
                            onProgress(progress, { 
                                epoch: epoch + 1,
                                loss: logs.loss,
                                acc: logs.acc
                            });
                        }
                    }
                }
            });

            this.isTrained = true;
            this.trainingHistory = history;

            // Cleanup
            images.dispose();
            labels.dispose();

            console.log('SIMPLE CNN training completed!');
            return history;

        } catch (error) {
            console.error('SIMPLE CNN Error:', error);
            throw error;
        }
    }

    async prepareData(dataset, onProgress) {
        const images = [];
        
        for (let i = 0; i < dataset.images.length; i++) {
            const tensor = await this.loadImage(dataset.images[i]);
            images.push(tensor);
            
            if (onProgress) {
                const progress = (i + 1) / dataset.images.length * 50;
                onProgress(progress, { stage: 'loading', current: i + 1 });
            }
        }

        const imageTensor = tf.stack(images);
        const labelTensor = tf.oneHot(tf.tensor1d(dataset.labels, 'int32'), Math.max(...dataset.labels) + 1);

        // Clean individual tensors
        images.forEach(t => t.dispose());

        return { images: imageTensor, labels: labelTensor };
    }

    async loadImage(imageDataUrl) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const tensor = tf.browser.fromPixels(img)
                    .resizeNearestNeighbor([32, 32])
                    .toFloat()
                    .div(255.0);
                resolve(tensor);
            };
            img.src = imageDataUrl;
        });
    }

    async evaluate(testImages, testLabels) {
        if (!this.isTrained) return { accuracy: 0 };
        
        try {
            const { images, labels } = await this.prepareData({
                images: testImages,
                labels: testLabels
            });

            const result = this.model.evaluate(images, labels);
            const accuracy = result[1].dataSync()[0];

            images.dispose();
            labels.dispose();
            result[0].dispose();
            result[1].dispose();

            return { accuracy: accuracy };
        } catch (error) {
            return { accuracy: 0 };
        }
    }

    async predict(imageDataUrl) {
        if (!this.isTrained) return [0];
        
        try {
            const tensor = await this.loadImage(imageDataUrl);
            const prediction = this.model.predict(tensor.expandDims(0));
            const result = await prediction.data();
            
            tensor.dispose();
            prediction.dispose();
            
            return Array.from(result);
        } catch (error) {
            return [0];
        }
    }

    saveModel() {
        return {
            type: 'cnn',
            timestamp: new Date().toISOString(),
            accuracy: 0.8
        };
    }

    dispose() {
        if (this.model) this.model.dispose();
    }
}