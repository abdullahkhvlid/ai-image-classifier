class DatasetManager {
    constructor() {
        this.classes = [];
        this.dataset = {
            images: [],
            labels: []
        };
        this.validationRules = {
            minClassSize: 5, // Reduced from 10 for easier testing
            maxImageSize: 5 * 1024 * 1024,
            allowedFormats: ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
        };
    }

    addClass(className) {
        // Input validation
        if (!className || typeof className !== 'string') {
            throw new Error('Class name must be a non-empty string');
        }
        
        if (className.length > 50) {
            throw new Error('Class name too long (max 50 characters)');
        }

        // Check if class already exists
        if (this.classes.find(c => c.name === className)) {
            throw new Error(`Class "${className}" already exists`);
        }

        const newClass = {
            id: this.classes.length,
            name: className,
            images: []
        };
        
        this.classes.push(newClass);
        return newClass;
    }

    deleteClass(className) {
        const index = this.classes.findIndex(c => c.name === className);
        if (index !== -1) {
            this.classes.splice(index, 1);
            // Update class IDs
            this.classes.forEach((c, i) => c.id = i);
            return true;
        }
        return false;
    }

    async addImageToClass(className, imageFile) {
        // Validate inputs
        if (!className || !imageFile) {
            throw new Error('Class name and image file are required');
        }

        // Validate image
        if (!this.validateImage(imageFile)) {
            throw new Error('Invalid image file. Supported formats: JPEG, PNG, GIF, WebP. Max size: 5MB');
        }

        const classObj = this.classes.find(c => c.name === className);
        if (!classObj) {
            throw new Error(`Class "${className}" not found`);
        }

        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const imageData = {
                        id: classObj.images.length,
                        file: imageFile,
                        dataUrl: e.target.result,
                        classId: classObj.id,
                        timestamp: Date.now()
                    };

                    classObj.images.push(imageData);
                    resolve(imageData);
                } catch (error) {
                    reject(new Error('Failed to process image: ' + error.message));
                }
            };
            
            reader.onerror = () => reject(new Error('Failed to read image file'));
            reader.onabort = () => reject(new Error('Image reading was aborted'));
            
            try {
                reader.readAsDataURL(imageFile);
            } catch (error) {
                reject(new Error('Invalid image file: ' + error.message));
            }
        });
    }

    validateImage(imageFile) {
        // Check if it's a file
        if (!(imageFile instanceof File)) {
            return false;
        }

        // Check file format
        if (!this.validationRules.allowedFormats.includes(imageFile.type)) {
            return false;
        }

        // Check file size
        if (imageFile.size > this.validationRules.maxImageSize) {
            return false;
        }

        // Check if file is empty
        if (imageFile.size === 0) {
            return false;
        }

        return true;
    }

    validateDataset() {
        const errors = [];

        // Check minimum number of classes
        if (this.classes.length < 2) {
            errors.push('At least 2 classes are required');
        }

        // Check minimum images per class
        this.classes.forEach(classObj => {
            if (classObj.images.length < this.validationRules.minClassSize) {
                errors.push(`Class "${classObj.name}" needs at least ${this.validationRules.minClassSize} images (currently: ${classObj.images.length})`);
            }
        });

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    prepareTrainingData() {
        const validation = this.validateDataset();
        if (!validation.isValid) {
            throw new Error(`Dataset validation failed: ${validation.errors.join(', ')}`);
        }

        // Reset dataset
        this.dataset = {
            images: [],
            labels: []
        };

        // Prepare data for training
        this.classes.forEach(classObj => {
            classObj.images.forEach(image => {
                this.dataset.images.push(image.dataUrl);
                this.dataset.labels.push(classObj.id);
            });
        });

        console.log(`Prepared training data: ${this.dataset.images.length} images, ${this.classes.length} classes`);
        return this.dataset;
    }

    getClassCount() {
        return this.classes.length;
    }

    getTotalImages() {
        return this.classes.reduce((total, classObj) => total + classObj.images.length, 0);
    }

    getClassDistribution() {
        return this.classes.map(classObj => ({
            name: classObj.name,
            count: classObj.images.length
        }));
    }

    // Utility method to clear all data
    clearAll() {
        this.classes = [];
        this.dataset = { images: [], labels: [] };
    }
}