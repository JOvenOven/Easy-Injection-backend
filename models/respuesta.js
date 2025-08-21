// Schema de respuestas
const answerSchema = new mongoose.Schema({
    pregunta_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Question', required: true },
    texto_respuesta: { type: String, required: true },
    es_correcta: { type: Boolean, default: false }
});

// Modelo
const Answer = mongoose.model('Answer', answerSchema);

// Validación con Joi
function validateAnswer(answer) {
    const schema = Joi.object({
        pregunta_id: Joi.string().required(),
        texto_respuesta: Joi.string().required(),
        es_correcta: Joi.boolean()
    });

    return schema.validate(answer);
}

exports.Answer = Answer;
exports.validate = validateAnswer;
