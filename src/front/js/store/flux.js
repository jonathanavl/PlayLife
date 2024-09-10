import axios from 'axios';
import Cookies from 'js-cookie';

const getState = ({ getStore, getActions, setStore }) => {
	return {
		store: {
			message: "",
			token: "",
			currentUser: null,
			isLoadingUser: true,
			isLoggedIn: false,
			users: [],
			games: [],
			genres: [],
			gameDetails: null, // Aquí almacenamos los detalles del juego seleccionado
			searchResults: [],
			reviews: [],
			events:[],
			posts: [],
			comments: []
		},
		actions: {
			login: async (email, password) => {
				try {
					const response = await axios.post(`${process.env.BACKEND_URL}/api/login`, { email, password });
					const { access_token } = response.data;
					if (access_token) {
						// Guardar token en una cookie
						Cookies.set('accessToken', access_token, { expires: 7 }); // La cookie expirará en 7 días
						await getActions().getCurrentUser();
						console.log("Login successful");
						console.log("Token:", access_token);
						return true;
					}
					return false;
				} catch (error) {
					console.error("Error al logear (flux.js):", error.response?.data?.message || error.message);
					return false;
				}
			},

			logout: () => {
				// Eliminar la cookie del token
				Cookies.remove('accessToken');
				setStore({
					currentUser: null,
					isLoggedIn: false,
				});
			},

			createUser: async (username, email, password) => {
				try {
					const response = await axios.post(`${process.env.BACKEND_URL}/api/signup`, { username, email, password });
					console.log("Usuario creado:", response.data);
					return true;
				} catch (error) {
					console.error("Error al crear usuario:", error.response?.data?.message || error.message);
					return false;
				}
			},

			getCurrentUser: async () => {
				try {
					const accessToken = Cookies.get('accessToken'); // Obtener token de la cookie
					if (!accessToken) throw new Error("No token found");
					const response = await axios.get(`${process.env.BACKEND_URL}/api/current-user`, {
						headers: {
							Authorization: `Bearer ${accessToken}`,
						}
					});
					setStore({ currentUser: response.data.current_user, isLoggedIn: true, isLoadingUser: false });
				} catch (error) {
					console.error("Error loading current user from backend:", error.response?.data?.message || error.message);
					Cookies.remove('accessToken'); // Eliminar la cookie si hay error
					setStore({
						currentUser: null,
						isLoggedIn: false,
						isLoadingUser: false,
					});
				}
			},

			searchGames: async (query) => {
				try {
					const response = await axios.get(`${process.env.API_RAWG_GET_URL}/games`, {
						params: {
							key: process.env.API_RAWG_KEY,
							search: query
						}
					});
					const formattedResults = response.data.results.map((game) => ({
						id: game.id,
						name: game.name
					}));
					setStore({ searchResults: formattedResults });
				} catch (error) {
					console.error("Error fetching games:", error.response?.data?.message || error.message);
				}
			},

			updateProfileImage: async (newImage) => {
				try {
					const accessToken = Cookies.get('accessToken');
					const response = await axios.put(`${process.env.BACKEND_URL}/api/update-avatar`, { avatar: newImage }, {
						headers: {
							Authorization: `Bearer ${accessToken}`,
						}
					});
					setStore({ currentUser: response.data });
					console.log("Imagen de perfil actualizada con éxito");
				} catch (error) {
					console.error("Error al actualizar la imagen de perfil:", error.response?.data?.message || error.message);
				}
			},

			getGames: async () => {
				try {
					const response = await axios.get(`${process.env.API_RAWG_GET_URL}/games`, {
						params: {
							key: process.env.API_RAWG_KEY
						}
					});
					setStore({ games: response.data.results });
				} catch (error) {
					console.error("Error fetching games:", error.response?.data?.message || error.message);
				}
			},

			loadMoreGames: async () => {
				try {
					const store = getStore();
					const currentLength = store.games.length;
					const response = await axios.get(`${process.env.API_RAWG_GET_URL}/games`, {
						params: {
							key: process.env.API_RAWG_KEY,
							page: Math.floor(currentLength / 20) + 1
						}
					});
					setStore({ games: [...store.games, ...response.data.results] });
				} catch (error) {
					console.error("Error fetching more games:", error.response?.data?.message || error.message);
				}
			},

			getGenres: async () => {
				try {
					const response = await axios.get(`${process.env.API_RAWG_GET_URL}/genres`, {
						params: {
							key: process.env.API_RAWG_KEY
						}
					});
					setStore({ genres: response.data.results });
				} catch (error) {
					console.error("Error fetching genres:", error.response?.data?.message || error.message);
				}
			},

			getGameById: async (gameId) => {
				try {
					const response = await axios.get(`${process.env.API_RAWG_GET_URL}/games/${gameId}`, {
						params: {
							key: process.env.API_RAWG_KEY
						}
					});
					setStore({ gameDetails: response.data });
				} catch (error) {
					console.error("Error fetching game by ID:", error.response?.data?.message || error.message);
				}
			},

			fetchReviews: async () => {
				try {
					const token = localStorage.getItem('accessToken'); // Asegúrate de usar el nombre correcto del token
					const response = await axios.get(`${process.env.BACKEND_URL}/api/reviews`, {
						headers: {
							'Authorization': `Bearer ${token}`
						}
					});
					// Verifica que la respuesta tenga el formato esperado
					if (response.data && Array.isArray(response.data)) {
						setStore({
							reviews: response.data,
							currentPage: 1, // Puedes ajustar esto si ya no usas la paginación
							totalPages: 1  // Puedes ajustar esto si ya no usas la paginación
						});
					} else {
						throw new Error('Unexpected response format');
					}
				} catch (error) {
					// Mostrar el mensaje de error adecuado
					console.error("Error fetching reviews:", error.response?.data?.msg || error.message || error.toString());
				}
			},

			addReview: async (review) => {
				try {
					const accessToken = Cookies.get('accessToken');
					// Asegúrate de que el objeto review contiene todos los campos necesarios
					const response = await axios.post(`${process.env.BACKEND_URL}/api/reviews/${review.game_id}`, {
						title: review.title,      // Título de la reseña
						comment: review.comment   // Comentario de la reseña
					}, {
						headers: {
							Authorization: `Bearer ${accessToken}`,
							"Content-Type": "application/json",
						},
					});
					if (response.status === 201) {
						getActions().getReviewsForGame(review.game_id);
					} else {
						console.error("Error al agregar la reseña");
					}
				} catch (error) {
					console.error("Error en addReview:", error.response?.data || error.message);
				}
			},

			changePage: (page) => {
				const { fetchReviews } = getActions();
				fetchReviews(page);
			},

			getReviewsForGame: async (gameId) => {
				try {
					const response = await axios.get(`${process.env.BACKEND_URL}/api/reviews/${gameId}`);
					setStore({ reviews: response.data });
				} catch (error) {
					console.error("Error fetching reviews:", error);
				}
			},

			updateReview: async (reviewId, updatedComment) => {
				try {
					const response = await axios.put(`${process.env.BACKEND_URL}/api/reviews/${reviewId}`, { comment: updatedComment });
					if (response.status === 200) {
						const updatedReview = response.data;
						const store = getStore();
						const updatedReviews = store.reviews.map(review =>
							review.id === reviewId ? updatedReview : review
						);
						setStore({ reviews: updatedReviews });
					}
				} catch (error) {
					console.error("Error updating review:", error);
				}
			},

			deleteReview: async (reviewId) => {
				try {
					const response = await axios.delete(`${process.env.BACKEND_URL}/api/reviews/${reviewId}`);
					if (response.status === 200) {
						const store = getStore();
						const updatedReviews = store.reviews.filter(review => review.id !== reviewId);
						setStore({ reviews: updatedReviews });
					}
				} catch (error) {
					console.error("Error deleting review:", error);
				}
			},

			getEvents: async () => {
				try {
					const response = await axios.get(`${process.env.BACKEND_URL}/api/events`);
					setStore({ events: response.data });
				} catch (error) {
					console.error("Error fetching events:", error.response?.data?.message || error.message);
				}
			},

			createEvent: async (event) => {
				try {
					// Obtiene el token de acceso almacenado en localStorage
					const accessToken = Cookies.get('accessToken');
					// Realiza una solicitud POST a la API para crear un nuevo evento
					const response = await axios.post(
						process.env.BACKEND_URL + "/api/events",
						event,
						{
							headers: {
								"Authorization": `Bearer ${accessToken}`, // Añade el token de autenticación en la cabecera
								"Content-Type": "application/json" // Especifica que el cuerpo de la solicitud es JSON
							}
						}
					);
					// Si la respuesta es exitosa, agrega el nuevo evento al store
					const store = getStore();
					setStore({ events: [...store.events, response.data] });
				} catch (error) {
					console.error("Error en createEvent:", error);
				}
			},

			updateEvent: async (eventId, updatedEvent) => {
				try {
					// Obtiene el token de acceso almacenado en localStorage
					const accessToken = Cookies.get('accessToken');
					const response = await axios.put(
						`${process.env.BACKEND_URL}/api/events/${eventId}`,
						updatedEvent,
						{
							headers: {
								"Authorization": `Bearer ${accessToken}`, // Añade el token de autenticación en la cabecera
								"Content-Type": "application/json" // Especifica que el cuerpo de la solicitud es JSON
							}
						}
					);
					// Si la respuesta es exitosa, actualiza el evento en el store
					const store = getStore();
					const updatedEvents = store.events.map(event => event.id === eventId ? response.data : event);
					setStore({ events: updatedEvents });
				} catch (error) {
					// Si ocurre un error durante la solicitud, lo registra en la consola
					console.error("Error en updateEvent:", error);
				}
			},

			deleteEvent: async (eventId) => {
				try {
					// Obtiene el token de acceso almacenado en localStorage
					const accessToken = Cookies.get('accessToken');

					// Realiza una solicitud DELETE a la API para eliminar un evento específico
					await axios.delete(`${process.env.BACKEND_URL}/api/events/${eventId}`, {
						headers: {
							"Authorization": `Bearer ${accessToken}` // Añade el token de autenticación en la cabecera
						}
					});
					// Si la respuesta es exitosa, elimina el evento del store
					const store = getStore();
					const updatedEvents = store.events.filter(event => event.id !== eventId);
					setStore({ events: updatedEvents });
				} catch (error) {
					// Si ocurre un error durante la solicitud, lo registra en la consola
					console.error("Error en deleteEvent:", error);
				}
			},

			attendEvent: async (eventId) => {
				try {
					// Obtiene el token de acceso almacenado en localStorage
					const accessToken = Cookies.get('accessToken');
					// Verifica si el usuario está autenticado
					if (!accessToken) {
						console.error("Debes estar registrado para asistir a un evento.");
						// Redirige a la página de inicio de sesión
						window.location.href = "/login";
						return;
					}
					await axios.post(`${process.env.BACKEND_URL}/api/events/${eventId}/attend`, null, {
						headers: {
							"Authorization": `Bearer ${accessToken}` // Añade el token de autenticación en la cabecera
						}
					});
					console.log("Asistencia registrada correctamente");
				} catch (error) {
					console.error("Error en attendEvent:", error);
				}
			},

			createPost: async (title, content, imageUrl) => {
				const token = localStorage.getItem('token');
				const resp = await fetch(process.env.BACKEND_URL + '/api/posts', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'Authorization': `Bearer ${token}`
					},
					body: JSON.stringify({
						
						title: title,
						content: content,
						image_url: imageUrl
						
					})
				});
				if (resp.ok) {
					const data = await resp.json();
					console.log('Post creado:', data);
				} else {
					console.error('Error al crear el post');
				}
			},
			
			updatePost: async (postId, title, content, imageUrl) => {
				const token = localStorage.getItem('token');
				const resp = await fetch(`${process.env.BACKEND_URL}/api/posts/${postId}`, {
					method: 'PUT',
					headers: {
						'Content-Type': 'application/json',
						'Authorization': `Bearer ${token}`
					},
					body: JSON.stringify({
						title: title,
						content: content,
						image_url: imageUrl
					})
				});
				if (resp.ok) {
					const data = await resp.json();
					console.log('Post actualizado:', data);
				} else {
					console.error('Error al actualizar el post');
				}
			},
			
			deletePost: async (postId) => {
				const token = localStorage.getItem('token');
				const resp = await fetch(`${process.env.BACKEND_URL}/api/posts/${postId}`, {
					method: 'DELETE',
					headers: {
						'Authorization': `Bearer ${token}`
					}
				});
				if (resp.ok) {
					console.log('Post eliminado');
				} else {
					console.error('Error al eliminar el post');
				}
			},
			getPostById: async (postId) => {
				try {
					const response = await fetch(`${process.env.BACKEND_URL}/api/posts/${postId}`);
					if (response.ok) {
						const post = await response.json();
						setStore({ currentPost: post });  // Guardar el post actual en el estado
					} else {
						console.error("Error al cargar el post");
					}
				} catch (error) {
					console.error("Error en getPostById:", error);
				}
			},
			getAllPost: async () => {
				try{
					const response = await axios.get(`${process.env.BACKEND_URL}/api/posts`);
					if (response.status === 200){
						console.log("Posts obtenidos correctamente:", response.data);
                        setStore({posts: response.data});
					}
				} catch (error){
					console.error("Error al obtener los posts:", error);
				}
			},
			
			createComment: async (postId, content) => {
				const token = localStorage.getItem('token');
				const resp = await fetch(`${process.env.BACKEND_URL}/api/posts/${postId}/comments`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'Authorization': `Bearer ${token}`
					},
					body: JSON.stringify({ content: content })
				});
				if (resp.ok) {
					const data = await resp.json();
					console.log('Comentario creado:', data);
				} else {
					console.error('Error al crear el comentario');
				}
			},	
			updateComment: async (commentId, content) => {
				const token = localStorage.getItem('token');
				const resp = await fetch(`${process.env.BACKEND_URL}/api/comments/${commentId}`, {
					method: 'PUT',
					headers: {
						'Content-Type': 'application/json',
						'Authorization': `Bearer ${token}`
					},
					body: JSON.stringify({ content: content })
				});
				if (resp.ok) {
					const data = await resp.json();
					console.log('Comentario actualizado:', data);
				} else {
					console.error('Error al actualizar el comentario');
				}
			},
			deleteComment: async (commentId) => {
				const token = localStorage.getItem('token');
				const resp = await fetch(`${process.env.BACKEND_URL}/api/comments/${commentId}`, {
					method: 'DELETE',
					headers: {
						'Authorization': `Bearer ${token}`
					}
				});
				if (resp.ok) {
					console.log('Comentario eliminado');
				} else {
					console.error('Error al eliminar el comentario');
				}
			},
			getCommentById: async (commentId) => {
				try {
					const response = await fetch(`${process.env.BACKEND_URL}/api/comments/${commentId}`);
					if (response.ok) {
						const comment = await response.json();
						setStore({ currentComment: comment });  // Guardar el comentario actual en el estado
					} else {
						console.error("Error al cargar el comentario");
					}
				} catch (error) {
					console.error("Error en getCommentById:", error);
				}
			},
			getAllComments: async () => {
				try{
					const response = await axios.get(`${process.env.BACKEND_URL}/api/comments`);
					if(response.status === 200){
						console.log("Comentarios obtenidos correctamente:", response.data);
						setStore({comments: response.data})
					}
				}catch (error){
					console.error("Error al obtener los comentarios:", error);
				}
			},
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
			getMessage: async () => {
				try {
					const response = await axios.get(`${process.env.BACKEND_URL}/api/hello`);
					setStore({ message: response.data.message });
					return response.data;
				} catch (error) {
					console.error("Error loading message from backend:", error.response?.data?.message || error.message);
				}
			},
		}
	};
};
export default getState;