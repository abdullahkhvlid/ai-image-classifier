class RandomForestTrainer {
    constructor() {
        this.model = null;
        this.isTrained = false;
        this.features = [];
        this.labels = [];
        this.numTrees = 50; // Reduced for performance
        this.classNames = [];
    }

    async train(dataset, onProgress = null) {
        try {
            if (!dataset || !dataset.images || dataset.images.length === 0) {
                throw new Error('No training data available');
            }

            const numClasses = Math.max(...dataset.labels) + 1;
            this.classNames = Array.from({length: numClasses}, (_, i) => `Class ${i}`);
            
            console.log(`Training Random Forest with ${dataset.images.length} images, ${numClasses} classes`);

            // Extract features from images
            this.features = await this.extractFeatures(dataset.images, onProgress);
            this.labels = dataset.labels;

            // Train Random Forest
            this.model = await this.trainRandomForest(this.features, this.labels, onProgress);
            this.isTrained = true;

            console.log('Random Forest training completed');
            return {
                accuracy: this.model.accuracy,
                trees: this.numTrees
            };
        } catch (error) {
            console.error('Error in Random Forest training:', error);
            throw error;
        }
    }

    async extractFeatures(images, onProgress) {
        const features = [];
        
        for (let i = 0; i < images.length; i++) {
            try {
                const imageDataUrl = images[i];
                const feature = await this.extractImageFeatures(imageDataUrl);
                features.push(feature);
                
                if (onProgress) {
                    const progress = (i + 1) / images.length * 50;
                    onProgress(progress, { stage: 'feature-extraction', current: i + 1, total: images.length });
                }
            } catch (error) {
                console.error(`Error extracting features from image ${i}:`, error);
                // Push zero features as fallback
                features.push(new Array(24).fill(0));
            }
        }
        
        return features;
    }

    async extractImageFeatures(imageDataUrl) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                try {
                    // Create canvas to process image
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    canvas.width = 16; // Smaller for performance
                    canvas.height = 16;
                    
                    ctx.drawImage(img, 0, 0, 16, 16);
                    const imageData = ctx.getImageData(0, 0, 16, 16);
                    
                    // Extract simple features
                    const features = this.computeImageFeatures(imageData);
                    resolve(features);
                } catch (error) {
                    reject(error);
                }
            };
            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = imageDataUrl;
        });
    }

    computeImageFeatures(imageData) {
        const data = imageData.data;
        const features = [];
        
        // Color histogram features
        const rHist = new Array(4).fill(0);
        const gHist = new Array(4).fill(0);
        const bHist = new Array(4).fill(0);
        
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            
            rHist[Math.floor(r / 64)]++;
            gHist[Math.floor(g / 64)]++;
            bHist[Math.floor(b / 64)]++;
        }
        
        // Normalize histograms
        const totalPixels = (data.length / 4);
        features.push(...rHist.map(val => val / totalPixels));
        features.push(...gHist.map(val => val / totalPixels));
        features.push(...bHist.map(val => val / totalPixels));
        
        // Mean colors
        features.push(
            rHist.reduce((sum, val, idx) => sum + val * (idx * 64 + 32), 0) / totalPixels / 255,
            gHist.reduce((sum, val, idx) => sum + val * (idx * 64 + 32), 0) / totalPixels / 255,
            bHist.reduce((sum, val, idx) => sum + val * (idx * 64 + 32), 0) / totalPixels / 255
        );
        
        return features;
    }

    async trainRandomForest(features, labels, onProgress) {
        return new Promise((resolve) => {
            // Simplified Random Forest implementation
            const trees = [];
            const numSamples = features.length;
            
            for (let i = 0; i < this.numTrees; i++) {
                // Bootstrap sample
                const sampleFeatures = [];
                const sampleLabels = [];
                
                for (let j = 0; j < numSamples; j++) {
                    const randomIndex = Math.floor(Math.random() * numSamples);
                    sampleFeatures.push(features[randomIndex]);
                    sampleLabels.push(labels[randomIndex]);
                }
                
                // Train decision tree
                const tree = this.trainDecisionTree(sampleFeatures, sampleLabels);
                trees.push(tree);
                
                if (onProgress) {
                    const progress = 50 + ((i + 1) / this.numTrees * 50);
                    onProgress(progress, { stage: 'tree-building', current: i + 1, total: this.numTrees });
                }
            }
            
            const accuracy = this.calculateAccuracy(features, labels, trees);
            resolve({ trees, accuracy });
        });
    }

    trainDecisionTree(features, labels, depth = 0, maxDepth = 10) {
        if (features.length === 0 || depth >= maxDepth) {
            return this.createLeafNode(labels);
        }
        
        const uniqueLabels = [...new Set(labels)];
        if (uniqueLabels.length === 1) {
            return { type: 'leaf', value: uniqueLabels[0], count: labels.length };
        }
        
        // Find best split
        const bestSplit = this.findBestSplit(features, labels);
        if (!bestSplit) {
            return this.createLeafNode(labels);
        }
        
        // Split data
        const leftFeatures = [];
        const leftLabels = [];
        const rightFeatures = [];
        const rightLabels = [];
        
        for (let i = 0; i < features.length; i++) {
            if (features[i][bestSplit.featureIndex] <= bestSplit.threshold) {
                leftFeatures.push(features[i]);
                leftLabels.push(labels[i]);
            } else {
                rightFeatures.push(features[i]);
                rightLabels.push(labels[i]);
            }
        }
        
        return {
            type: 'node',
            featureIndex: bestSplit.featureIndex,
            threshold: bestSplit.threshold,
            left: this.trainDecisionTree(leftFeatures, leftLabels, depth + 1, maxDepth),
            right: this.trainDecisionTree(rightFeatures, rightLabels, depth + 1, maxDepth)
        };
    }

    createLeafNode(labels) {
        const counts = {};
        labels.forEach(label => {
            counts[label] = (counts[label] || 0) + 1;
        });
        
        const majorityLabel = Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
        return { 
            type: 'leaf', 
            value: parseInt(majorityLabel), 
            count: labels.length,
            distribution: counts 
        };
    }

    findBestSplit(features, labels) {
        if (features.length === 0) return null;
        
        const numFeatures = features[0].length;
        let bestGain = -1;
        let bestSplit = null;
        
        // Try random features
        const numFeaturesToTry = Math.max(1, Math.floor(Math.sqrt(numFeatures)));
        const triedFeatures = new Set();
        
        while (triedFeatures.size < numFeaturesToTry) {
            const featureIndex = Math.floor(Math.random() * numFeatures);
            if (triedFeatures.has(featureIndex)) continue;
            triedFeatures.add(featureIndex);
            
            const values = features.map(f => f[featureIndex]);
            const uniqueValues = [...new Set(values)];
            
            if (uniqueValues.length <= 1) continue;
            
            // Try a few random thresholds
            for (let i = 0; i < 5; i++) {
                const threshold = uniqueValues[Math.floor(Math.random() * uniqueValues.length)];
                const gain = this.calculateInformationGain(features, labels, featureIndex, threshold);
                
                if (gain > bestGain) {
                    bestGain = gain;
                    bestSplit = { featureIndex, threshold, gain };
                }
            }
        }
        
        return bestSplit;
    }

    calculateInformationGain(features, labels, featureIndex, threshold) {
        // Simplified information gain calculation
        const leftLabels = [];
        const rightLabels = [];
        
        for (let i = 0; i < features.length; i++) {
            if (features[i][featureIndex] <= threshold) {
                leftLabels.push(labels[i]);
            } else {
                rightLabels.push(labels[i]);
            }
        }
        
        const total = labels.length;
        const leftEntropy = this.calculateEntropy(leftLabels);
        const rightEntropy = this.calculateEntropy(rightLabels);
        
        return this.calculateEntropy(labels) - 
               (leftLabels.length / total) * leftEntropy - 
               (rightLabels.length / total) * rightEntropy;
    }

    calculateEntropy(labels) {
        if (labels.length === 0) return 0;
        
        const counts = {};
        labels.forEach(label => {
            counts[label] = (counts[label] || 0) + 1;
        });
        
        let entropy = 0;
        Object.values(counts).forEach(count => {
            const probability = count / labels.length;
            entropy -= probability * Math.log2(probability);
        });
        
        return entropy;
    }

    calculateAccuracy(features, labels, trees) {
        let correct = 0;
        
        for (let i = 0; i < features.length; i++) {
            const prediction = this.predictInstance(features[i], trees);
            if (prediction === labels[i]) {
                correct++;
            }
        }
        
        return correct / features.length;
    }

    predictInstance(features, trees) {
        const votes = {};
        
        for (const tree of trees) {
            const prediction = this.traverseTree(features, tree);
            votes[prediction] = (votes[prediction] || 0) + 1;
        }
        
        // Return majority vote
        return Object.keys(votes).reduce((a, b) => votes[a] > votes[b] ? parseInt(a) : parseInt(b));
    }

    traverseTree(features, tree) {
        if (tree.type === 'leaf') {
            return tree.value;
        }
        
        if (features[tree.featureIndex] <= tree.threshold) {
            return this.traverseTree(features, tree.left);
        } else {
            return this.traverseTree(features, tree.right);
        }
    }

    async evaluate(testImages, testLabels) {
        if (!this.isTrained) {
            throw new Error('Model not trained yet');
        }

        try {
            const testFeatures = await this.extractFeatures(testImages);
            let correct = 0;
            
            for (let i = 0; i < testFeatures.length; i++) {
                const prediction = this.predictInstance(testFeatures[i], this.model.trees);
                if (prediction === testLabels[i]) {
                    correct++;
                }
            }
            
            const accuracy = correct / testFeatures.length;
            
            return {
                accuracy: accuracy,
                trees: this.numTrees
            };
        } catch (error) {
            console.error('Error in evaluation:', error);
            throw error;
        }
    }

    async predict(imageDataUrl) {
        if (!this.isTrained) {
            throw new Error('Model not trained yet');
        }

        try {
            const features = await this.extractImageFeatures(imageDataUrl);
            const votes = {};
            
            for (const tree of this.model.trees) {
                const prediction = this.traverseTree(features, tree);
                votes[prediction] = (votes[prediction] || 0) + 1;
            }
            
            // Convert to probabilities
            const totalTrees = this.model.trees.length;
            const numClasses = Math.max(...this.labels) + 1;
            const probabilities = [];
            
            for (let i = 0; i < numClasses; i++) {
                probabilities.push((votes[i] || 0) / totalTrees);
            }
            
            return probabilities;
        } catch (error) {
            console.error('Error in prediction:', error);
            throw error;
        }
    }

    saveModel() {
        if (!this.isTrained) {
            throw new Error('Model not trained yet');
        }
        
        return {
            type: 'random-forest',
            timestamp: new Date().toISOString(),
            accuracy: this.model.accuracy,
            numTrees: this.numTrees
        };
    }
}