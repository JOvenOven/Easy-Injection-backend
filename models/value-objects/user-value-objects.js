// Value Objects for User model

class Profile {
    #nivel_actual;
    #avatarId;

    constructor(data = {}) {
        this.#nivel_actual = data.nivel_actual || 1;
        this.#avatarId = data.avatarId || 'avatar1';
    }

    get nivel_actual() { return this.#nivel_actual; }
    get avatarId() { return this.#avatarId; }

    levelUp() {
        this.#nivel_actual++;
        return this.#nivel_actual;
    }

    setAvatar(avatarId) {
        const validAvatars = ['avatar1', 'avatar2', 'avatar3', 'avatar4', 'avatar5', 'avatar6'];
        if (!validAvatars.includes(avatarId)) {
            throw new Error('Avatar ID inválido');
        }
        this.#avatarId = avatarId;
    }

    getLevel() {
        return this.#nivel_actual;
    }

    isMaxLevel() {
        return this.#nivel_actual >= 100;
    }

    toObject() {
        return {
            nivel_actual: this.#nivel_actual,
            avatarId: this.#avatarId
        };
    }

    static createDefault() {
        return new Profile({ nivel_actual: 1, avatarId: 'avatar1' });
    }
}

class Notification {
    #titulo;
    #mensaje;
    #leida;
    #fecha_creacion;

    constructor(data = {}) {
        this.#titulo = data.titulo;
        this.#mensaje = data.mensaje;
        this.#leida = data.leida !== undefined ? data.leida : false;
        this.#fecha_creacion = data.fecha_creacion || new Date();
    }

    get titulo() { return this.#titulo; }
    get mensaje() { return this.#mensaje; }
    get leida() { return this.#leida; }
    get fecha_creacion() { return this.#fecha_creacion; }

    markAsRead() {
        this.#leida = true;
    }

    markAsUnread() {
        this.#leida = false;
    }

    isRead() {
        return this.#leida === true;
    }

    isUnread() {
        return this.#leida === false;
    }

    getAge() {
        return Math.floor((new Date() - this.#fecha_creacion) / (1000 * 60 * 60 * 24));
    }

    isRecent() {
        return this.getAge() <= 7;
    }

    toObject() {
        return {
            titulo: this.#titulo,
            mensaje: this.#mensaje,
            leida: this.#leida,
            fecha_creacion: this.#fecha_creacion
        };
    }

    static create(titulo, mensaje) {
        return new Notification({ titulo, mensaje, leida: false });
    }
}

class AnswerHistory {
    #pregunta_id;
    #respuesta_id;
    #correcta;
    #tiempo_respuesta_seg;
    #puntos_obtenidos;
    #fecha_respuesta;

    constructor(data = {}) {
        this.#pregunta_id = data.pregunta_id;
        this.#respuesta_id = data.respuesta_id;
        this.#correcta = data.correcta !== undefined ? data.correcta : false;
        this.#tiempo_respuesta_seg = data.tiempo_respuesta_seg;
        this.#puntos_obtenidos = data.puntos_obtenidos || 0;
        this.#fecha_respuesta = data.fecha_respuesta || new Date();
    }

    get pregunta_id() { return this.#pregunta_id; }
    get respuesta_id() { return this.#respuesta_id; }
    get correcta() { return this.#correcta; }
    get tiempo_respuesta_seg() { return this.#tiempo_respuesta_seg; }
    get puntos_obtenidos() { return this.#puntos_obtenidos; }
    get fecha_respuesta() { return this.#fecha_respuesta; }

    isCorrect() {
        return this.#correcta === true;
    }

    isIncorrect() {
        return this.#correcta === false;
    }

    isFastAnswer() {
        return this.#tiempo_respuesta_seg && this.#tiempo_respuesta_seg < 10;
    }

    getPoints() {
        return this.#puntos_obtenidos;
    }

    toObject() {
        return {
            pregunta_id: this.#pregunta_id,
            respuesta_id: this.#respuesta_id,
            correcta: this.#correcta,
            tiempo_respuesta_seg: this.#tiempo_respuesta_seg,
            puntos_obtenidos: this.#puntos_obtenidos,
            fecha_respuesta: this.#fecha_respuesta
        };
    }

    static create(preguntaId, respuestaId, correcta, puntos, tiempoSeg) {
        return new AnswerHistory({
            pregunta_id: preguntaId,
            respuesta_id: respuestaId,
            correcta,
            puntos_obtenidos: puntos,
            tiempo_respuesta_seg: tiempoSeg
        });
    }
}

module.exports = {
    Profile,
    Notification,
    AnswerHistory
};
