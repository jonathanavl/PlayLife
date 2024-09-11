"""
This module takes care of starting the API Server, Loading the DB and Adding the endpoints
"""
from flask import Flask, request, jsonify, url_for, Blueprint, make_response
from api.models import db, User, Review, Event, Post, Comment
from api.utils import generate_sitemap, APIException
from flask_cors import CORS
from flask_jwt_extended import create_access_token, get_jwt_identity, jwt_required, verify_jwt_in_request
from flask_socketio import emit

api = Blueprint('api', __name__)

# Allow CORS requests to this API
CORS(api, supports_credentials=True)

@api.route("/login", methods=["POST"])
def login():
    # Obtiene el email y password del cuerpo de la solicitud JSON. Si no se proporcionan, se establece como None.
    email = request.json.get("email", None)
    password = request.json.get("password", None)
    # Verifica si el email o password no fueron proporcionados
    if email is None or password is None:
        return jsonify({"msg": "Usuario o Password erroneos"}), 401
    # Busca al usuario en la base de datos por su email
    user_query = User.query.filter_by(email=email)
    user = user_query.first()  # Obtiene el primer resultado de la consulta
    # Si no se encuentra el usuario, devuelve un mensaje de error
    if user is None:
        return jsonify({"msg": "Usuario o Password erroneos"}), 401
    # Verifica que el email y password coincidan con los del usuario en la base de datos
    if user.email != email or user.password != password:
        return jsonify({"msg": "Usuario o Password erroneos"}), 401
    # Si todo es correcto, crea un token de acceso para el usuario usando su id como identidad
    access_token = create_access_token(identity=user.id)
    # Devuelve el token de acceso como respuesta JSON
    return jsonify(access_token=access_token)

@api.route("/logout", methods=["POST"])
def logout():
    # Elimina la cookie que contiene el token
    response = make_response(jsonify({"msg": "Logout exitoso"}))
    response.delete_cookie('access_token_cookie')
    return response

@api.route('/signup', methods=['POST'])
def create_user():
    # Obtiene los datos del cuerpo de la solicitud JSON
    data = request.json
    # Crea un nuevo usuario con el email y password proporcionados
    new_user = User(username=data['username'], email=data['email'], password=data['password'])
    # Añade el nuevo usuario a la sesión de la base de datos
    db.session.add(new_user)
    # Confirma los cambios en la base de datos (guarda el nuevo usuario)
    db.session.commit()
    # Devuelve los datos del nuevo usuario como respuesta JSON
    return jsonify({"user": new_user.serialize()}), 200

@api.route("/current-user", methods=["GET"])
def get_current_user():
    # Intentamos verificar el JWT en la cookie
    try:
        verify_jwt_in_request()
        current_user_id = get_jwt_identity()
        if current_user_id is None:
            return jsonify({"msg": "Usuario no encontrado"}), 401
        user_query = User.query.get(current_user_id)
        if user_query is None:
            return jsonify({"msg": "Usuario no encontrado"}), 401
        return jsonify(current_user=user_query.serialize()), 200
    except Exception as e:
        return jsonify({"msg": "Token inválido o inexistente", "error": str(e)}), 401

@api.route('/reviews', methods=['GET'])
def get_current_user_reviews():
    try:
        verify_jwt_in_request()
        current_user_id = get_jwt_identity()
        if current_user_id is None:
            return jsonify({"msg": "Usuario no encontrado"}), 401
        user_query = User.query.get(current_user_id)
        if user_query is None:
            return jsonify({"msg": "Usuario no encontrado"}), 401
        reviews_query = Review.query.filter_by(user_id=current_user_id) 
        reviews = reviews_query.all()
        return jsonify([review.serialize() for review in reviews])
    except Exception as e:
        return jsonify({"msg": "Token inválido o inexistente", "error": str(e)}), 401


@api.route('/reviews/<int:game_id>', methods=['GET'])
def get_reviews_by_id(game_id):
    reviews = Review.query.filter_by(game_id=game_id).all()
    return jsonify([review.serialize() for review in reviews])

@api.route('/reviews/<int:game_id>', methods=['POST'])
def add_review(game_id):
    try:
        verify_jwt_in_request()
    except:
        return jsonify({"msg": "Unauthorized"}), 401
    current_user_id = get_jwt_identity()
    if current_user_id is None:
        return jsonify({"msg": "Usuario no encontrado"}), 401
    user_query = User.query.get(current_user_id)
    if user_query is None:
        return jsonify({"msg": "Usuario no encontrado"}), 401
    data = request.json
    if 'title' not in data:
        return jsonify({"error": "title is required"}), 400
    if 'comment' not in data:
        return jsonify({"error": "comment is required"}), 400
    new_review = Review(
        game_id=game_id,
        title=data['title'],
        comment=data['comment']
    )
    user_query.reviews.append(new_review)
    db.session.commit()
    return jsonify(new_review.serialize()), 201

@api.route('/reviews/<int:review_id>', methods=['DELETE'])
def delete_review(review_id):
    review = Review.query.get_or_404(review_id)
    db.session.delete(review)
    db.session.commit()
    return jsonify({"message": "Review deleted successfully"}), 200

@api.route('/reviews/<int:review_id>', methods=['PUT'])
def update_review(review_id):
    # Obtener la reseña existente usando el ID
    review = Review.query.get_or_404(review_id)
    # Obtener los datos enviados en la solicitud
    data = request.json
    # Actualizar los campos de la reseña si están presentes en los datos
    if 'title' in data:
        review.comment = data['title']
    if 'comment' in data:
        review.comment = data['comment']
    # Guardar los cambios en la base de datos
    db.session.commit()
    # En la respuesta JSON, convierte la instancia del modelo Review en un diccionario de Python.
    return jsonify(review.serialize()), 200

@api.route('/update-avatar', methods=['PUT'])
def update_avatar():
    try:
        verify_jwt_in_request()
    except:
        return jsonify({"msg": "Unauthorized"}), 401
    user_id = get_jwt_identity()
    data = request.get_json()
    new_avatar_url = data.get('avatar')
    if not new_avatar_url:
        return jsonify({"msg": "No image URL provided"}), 400
    user = User.query.get(user_id)
    if not user:
        return jsonify({"msg": "User not found"}), 404
    user.profile_image = new_avatar_url
    db.session.commit()
    return jsonify(user.serialize()), 200

@api.route('/users', methods=['GET'])
def get_users():
    users = User.query.all()
    all_users = list(map(lambda x: x.serialize(), users))
    return jsonify(all_users), 200

@api.route('/events', methods=['GET'])
def get_events():
    events = Event.query.all()
    result = [event.serialize() for event in events]
    return jsonify(result)

@api.route('/events', methods=['POST'])
def add_event():
    data = request.json
    new_event = Event(
        name=data['name'],
        description=data['description'],
        date=data['date'],  # Asegúrate de que la fecha esté en un formato correcto, como ISO 8601
        image_url=data.get('image_url')  # Añadir la URL de la imagen
    )
    db.session.add(new_event)
    db.session.commit()
    return jsonify(new_event.serialize()), 201

@api.route('/events/<int:event_id>/attend', methods=['POST'])
def attend_event(event_id):
    try:
        verify_jwt_in_request()
        current_user_id = get_jwt_identity()
        event = Event.query.get_or_404(event_id)
        user = User.query.get(current_user_id)
        if user in event.attendees:
            return jsonify({"message": "Ya estás registrado en este evento"}), 400
        event.attendees.append(user)
        db.session.commit()
        return jsonify({"message": "Asistencia registrada"}), 200
    except Exception as e:
        return jsonify({"msg": "Token inválido o inexistente", "error": str(e)}), 401

@api.route('/events/<int:event_id>', methods=['PUT'])
def update_event(event_id):
    event = Event.query.get_or_404(event_id)
    data = request.json
    
    event.name = data.get('name', event.name)
    event.description = data.get('description', event.description)
    event.date = data.get('date', event.date)  # Nuevamente, asegúrate de que la fecha esté en un formato correcto
    event.image_url = data.get('image_url', event.image_url)  # Actualizar la URL de la imagen
    
    db.session.commit()
    return jsonify(event.serialize()), 200


@api.route('/events/<int:event_id>', methods=['DELETE'])
def delete_event(event_id):
    event = Event.query.get_or_404(event_id)
    db.session.delete(event)
    db.session.commit()
    return jsonify({"message": "Event deleted successfully"}), 200

# Obtener todos los Post
@api.route('/posts', methods=['GET'])
def get_all_posts():
    posts = Post.query.all()
    return jsonify([post.serialize() for post in posts]), 200

# Obtener un Post en específico
@api.route('/posts/<int:post_id>', methods=['GET'])
def get_post(post_id):
    post = Post.query.get_or_404(post_id)
    return jsonify(post.serialize()), 200

@api.route('/posts', methods=['POST'])
def create_post():
    try:
        verify_jwt_in_request()
        current_user_id = get_jwt_identity()
        data = request.get_json()
        new_post = Post(
            title=data['title'],
            content=data['content'],
            image_url=data.get('image_url'),
            user_id=current_user_id
        )
        db.session.add(new_post)
        db.session.commit()
        # Emitir el nuevo post a todos los clientes
        post_data = new_post.serialize()
        emit('new_post', post_data, broadcast=True)
        return jsonify(post_data), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": str(e)}), 500

@api.route('/posts/<int:post_id>', methods=['PUT'])
def update_post(post_id):
    try:
        verify_jwt_in_request()
    except:
        return jsonify({"msg": "Unauthorized"}), 401
    current_user_id = get_jwt_identity()
    post = Post.query.get_or_404(post_id)

    if post.user_id != current_user_id:
        return jsonify({"error": "Unauthorized"}), 403
    data = request.get_json()
    post.title = data.get('title', post.title)
    post.content = data.get('content', post.content)
    post.image_url = data.get('image_url', post.image_url)
    db.session.commit()
    return jsonify(post.serialize()), 200

@api.route('/posts/<int:post_id>', methods=['DELETE'])
def delete_post(post_id):
    try:
        verify_jwt_in_request()
    except:
        return jsonify({"msg": "Unauthorized"}), 401
    current_user_id = get_jwt_identity()
    post = Post.query.get_or_404(post_id)
    if post.user_id != current_user_id:
        return jsonify({"error": "Unauthorized"}), 403
    db.session.delete(post)
    db.session.commit()
    return jsonify({"message": "Post deleted successfully"}), 200

@api.route('/posts/<int:post_id>/comments', methods=['POST'])
def create_comment(post_id):
    try:
        verify_jwt_in_request()
    except:
        return jsonify({"msg": "Unauthorized"}), 401
    current_user_id = get_jwt_identity()
    data = request.get_json()
    new_comment = Comment(
        content=data['content'],
        user_id=current_user_id,
        post_id=post_id
    )
    db.session.add(new_comment)
    db.session.commit()
    return jsonify(new_comment.serialize()), 201

# Obtener todos los comentarios
@api.route('/posts/<int:post_id>/comments', methods=['GET'])
def get_comments_by_post(post_id):
    comments = Comment.query.filter_by(post_id=post_id).all()
    return jsonify([comment.serialize() for comment in comments]), 200

# Obtener un comentario en especifico
@api.route('/comments/<int:comment_id>', methods=['GET'])
def get_comment(comment_id):
    comment = Comment.query.get_or_404(comment_id)
    return jsonify(comment.serialize()), 200

# Ruta para actualizar un Comment existente
@api.route('/comments/<int:comment_id>', methods=['PUT'])
def update_comment(comment_id):
    try:
        verify_jwt_in_request()
    except:
        return jsonify({"msg": "Unauthorized"}), 401
    current_user_id = get_jwt_identity()
    comment = Comment.query.get_or_404(comment_id)
    if comment.user_id != current_user_id:
        return jsonify({"error": "Unauthorized"}), 403
    data = request.get_json()
    comment.content = data.get('content', comment.content)
    db.session.commit()
    return jsonify(comment.serialize()), 200

# Ruta para eliminar un Comment existente
@api.route('/comments/<int:comment_id>', methods=['DELETE'])
def delete_comment(comment_id):
    try:
        verify_jwt_in_request()
    except:
        return jsonify({"msg": "Unauthorized"}), 401
    current_user_id = get_jwt_identity()
    comment = Comment.query.get_or_404(comment_id)
    if comment.user_id != current_user_id:
        return jsonify({"error": "Unauthorized"}), 403
    db.session.delete(comment)
    db.session.commit()
    return jsonify({"message": "Comment deleted successfully"}), 200

@api.route('/hello', methods=['POST', 'GET'])
def handle_hello():
    response_body = {
        "message": "Hello! I'm a message that came from the backend, check the network tab on the google inspector and you will see the GET request"
    }
    return jsonify(response_body), 200