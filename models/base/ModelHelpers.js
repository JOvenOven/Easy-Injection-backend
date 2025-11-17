/**
 * Utilidades helper para reducir código repetitivo en modelos
 */

/**
 * Crea un objeto plano a partir de campos privados
 * @param {Object} instance - Instancia del modelo
 * @param {Array<string>} fields - Lista de nombres de campos (sin #)
 * @returns {Object} Objeto plano con los campos definidos
 */
function buildObject(instance, fields) {
    const obj = {};
    
    // Siempre incluir _id y __v si existen
    if (instance._id !== undefined) obj._id = instance._id;
    
    // Agregar cada campo si está definido
    fields.forEach(fieldName => {
        const value = instance[fieldName];
        if (value !== undefined) {
            // Si el valor tiene toObject, llamarlo (Value Objects)
            if (value && typeof value.toObject === 'function') {
                obj[fieldName] = value.toObject();
            } else if (Array.isArray(value)) {
                // Si es array, convertir cada elemento si tiene toObject
                obj[fieldName] = value.map(item => 
                    item && typeof item.toObject === 'function' ? item.toObject() : item
                );
            } else {
                obj[fieldName] = value;
            }
        }
    });
    
    if (instance.__v !== undefined) obj.__v = instance.__v;
    
    return obj;
}

/**
 * Define getters y setters simples para campos privados
 * Reduce boilerplate code para propiedades básicas
 */
class PropertyBuilder {
    static simpleProperty(instance, privateField, publicName, validator = null) {
        Object.defineProperty(instance, publicName, {
            get() {
                return privateField;
            },
            set(value) {
                if (validator) {
                    const error = validator(value);
                    if (error) throw new Error(error);
                }
                privateField = value;
            },
            enumerable: true,
            configurable: false
        });
    }
}

/**
 * Validadores comunes reutilizables
 */
const Validators = {
    required: (fieldName) => (value) => {
        if (!value) return `${fieldName} es obligatorio`;
        return null;
    },
    
    maxLength: (fieldName, max) => (value) => {
        if (value && value.length > max) {
            return `${fieldName} no puede exceder ${max} caracteres`;
        }
        return null;
    },
    
    minLength: (fieldName, min) => (value) => {
        if (value && value.length < min) {
            return `${fieldName} debe tener al menos ${min} caracteres`;
        }
        return null;
    },
    
    enum: (fieldName, validValues) => (value) => {
        if (value && !validValues.includes(value)) {
            return `${fieldName} inválido. Debe ser uno de: ${validValues.join(', ')}`;
        }
        return null;
    },
    
    combine: (...validators) => (value) => {
        for (const validator of validators) {
            const error = validator(value);
            if (error) return error;
        }
        return null;
    }
};

module.exports = {
    buildObject,
    PropertyBuilder,
    Validators
};
