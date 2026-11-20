(function (FF) {
  'use strict';
  const { store } = FF;
  const stored = store.get('fg_language', 'es');
  const lang = ['en', 'fr'].includes(stored) ? stored : 'es';
  const table = new Map();
  const rows = `
Ajustes|Settings|Réglages
Notificaciones|Notifications|Notifications
Personaliza FGFootBall Plus en este dispositivo.|Customize FGFootBall Plus on this device.|Personnalisez FGFootBall Plus sur cet appareil.
Idioma|Language|Langue
Tema|Theme|Thème
Oscuro|Dark|Sombre
Claro|Light|Clair
Sistema|System|Système
Reducir animaciones|Reduce motion|Réduire les animations
Traducir rumores si el navegador lo permite|Translate rumours when supported|Traduire les rumeurs si le navigateur le permet
Monitor de goles|Goal alerts|Alertes de buts
Todos los partidos de la competición|All matches in the competition|Tous les matchs de la compétition
Solo mis equipos favoritos|Favorite teams only|Uniquement mes équipes favorites
Desactivado|Off|Désactivé
Los avisos se generan mientras FGFootBall Plus está abierto.|Alerts are generated while FGFootBall Plus is open.|Les alertes sont générées lorsque FGFootBall Plus est ouvert.
Activar notificaciones del dispositivo|Enable device notifications|Activer les notifications de l’appareil
Mostrar avisos del dispositivo|Show device alerts|Afficher les alertes de l’appareil
Permiso concedido.|Permission granted.|Autorisation accordée.
Permiso bloqueado en los ajustes del dispositivo.|Permission blocked in device settings.|Autorisation bloquée dans les réglages de l’appareil.
Puedes activar los avisos del dispositivo.|You can turn on device notifications.|Vous pouvez activer les notifications de l’appareil.
Este dispositivo solo admite avisos dentro de FGFootBall Plus.|This device only supports alerts inside FGFootBall Plus.|Cet appareil ne prend en charge que les alertes dans FGFootBall Plus.
Avisos de goles detectados en este dispositivo.|Goals detected on this device.|Buts détectés sur cet appareil.
Borrar avisos|Clear alerts|Effacer les alertes
Todavía no tienes avisos.|No alerts yet.|Aucune alerte pour le moment.
Imagen de perfil|Profile picture|Photo de profil
Quitar foto|Remove photo|Supprimer la photo
Imagen de perfil guardada.|Profile picture saved.|Photo de profil enregistrée.
La foto se guarda solo en este dispositivo.|Your picture is stored only on this device.|Votre photo est enregistrée uniquement sur cet appareil.
Inicia sesión para cambiar la imagen de perfil.|Sign in to change your profile picture.|Connectez-vous pour changer votre photo de profil.
Selecciona un archivo JPG, PNG o WebP de hasta 8 MB.|Choose a JPG, PNG or WebP file up to 8 MB.|Sélectionnez un fichier JPG, PNG ou WebP de 8 Mo maximum.
Selecciona una imagen válida.|Choose a valid picture.|Sélectionnez une image valide.
La imagen supera los 32 megapíxeles.|The image exceeds 32 megapixels.|L’image dépasse 32 mégapixels.
Cambiar foto y otros ajustes|Change picture and other settings|Changer la photo et d’autres réglages
FICHAS INDIVIDUALES|PLAYER PROFILES|FICHES INDIVIDUELLES
FICHA DEL JUGADOR|PLAYER PROFILE|FICHE DU JOUEUR
Buscar jugadores|Find players|Rechercher des joueurs
Nombre del jugador|Player name|Nom du joueur
Buscar futbolista…|Search for a player…|Rechercher un joueur…
Buscar|Search|Rechercher
No se encontraron futbolistas. Prueba con otro nombre.|No players found. Try another name.|Aucun joueur trouvé. Essayez un autre nom.
No se pudo buscar en ESPN. Pulsa «Buscar» para reintentar.|Could not search ESPN. Select Search to try again.|Recherche ESPN indisponible. Sélectionnez Rechercher pour réessayer.
Escribe al menos dos letras.|Enter at least two letters.|Saisissez au moins deux lettres.
Buscando en ESPN…|Searching ESPN…|Recherche sur ESPN…
Consultando estadísticas de ESPN…|Loading ESPN statistics…|Chargement des statistiques ESPN…
No se pudieron consultar las estadísticas de ESPN.|Could not load statistics from ESPN.|Impossible de consulter les statistiques ESPN.
ESPN no tiene estadísticas para esta competición y temporada.|ESPN does not have statistics for this competition and season.|ESPN ne propose pas de statistiques pour cette compétition et saison.
— significa que la fuente no publicó el dato.|— means the source did not publish a value.|— indique que la source n’a pas publié cette donnée.
La media es goles ÷ partidos disputados. El equipo sin contexto de ranking corresponde al perfil actual.|Average = goals ÷ appearances. Outside the rankings, the team shown is from the current profile.|Moyenne = buts ÷ matchs joués. Hors classement, l’équipe affichée est celle du profil actuel.
Estadísticas de la temporada|Season statistics|Statistiques de la saison
Titularidades|Starts|Titularisations
Entradas como suplente|Substitute appearances|Entrées en jeu
Goles por partido|Goals per game|Buts par match
Goles|Goals|Buts
Asistencias|Assists|Passes décisives
Tarjetas amarillas|Yellow cards|Cartons jaunes
Tarjetas rojas|Red cards|Cartons rouges
Partidos disputados|Appearances|Matchs joués
Minutos jugados|Minutes played|Minutes jouées
Equipo|Team|Équipe
Nacionalidad|Nationality|Nationalité
Edad actual|Current age|Âge actuel
Posición|Position|Poste
Portero|Goalkeeper|Gardien
Defensa|Defender|Défenseur
Centrocampista|Midfielder|Milieu
Delantero|Forward|Attaquant
RUMOR DE USUARIO|USER RUMOUR|RUMEUR D’UN UTILISATEUR
Información aportada por un usuario, sin verificar.|Unverified information submitted by a user.|Information non vérifiée soumise par un utilisateur.
Si lo compartes, quien reciba el enlace o mensaje podrá leer y reenviar todo el texto, aunque lo borres de tu perfil. No incluyas datos personales.|Anyone who receives the link or message can read and forward its full text, even if you delete it from your profile. Do not include personal information.|Toute personne qui reçoit le lien ou le message peut lire et transférer son contenu, même après sa suppression de votre profil. N’incluez pas de données personnelles.
Idioma del rumor|Rumour language|Langue de la rumeur
La traducción no está disponible en este dispositivo. Mostramos el original.|Translation is unavailable on this device. Showing the original.|La traduction est indisponible sur cet appareil. Affichage de l’original.
Traduciendo…|Translating…|Traduction…
Traducir ahora|Translate now|Traduire maintenant
Traducción automática.|Machine translation.|Traduction automatique.
Ver original|Show original|Afficher l’original
Compartir rumor|Share rumour|Partager la rumeur
Enlace copiado.|Link copied.|Lien copié.
No se pudo compartir desde este dispositivo.|Could not share from this device.|Partage impossible depuis cet appareil.
Rumor|Rumour|Rumeur
Rumores|Rumours|Rumeurs
Confirmado|Confirmed|Confirmé
Renovación|Renewal|Prolongation
Tipo|Type|Type
Titular|Headline|Titre
Detalles y fuente|Details and source|Détails et source
Enviar|Submit|Envoyer
Enviar una noticia|Submit a story|Proposer une info
La noticia que añadas solo se guarda en este navegador. No se envía a un servidor.|Your story is stored only on this device. It is not sent to a server.|Votre info est enregistrée uniquement sur cet appareil. Elle n’est pas envoyée à un serveur.
Saltar al contenido|Skip to content|Aller au contenu
Principal|Main navigation|Navigation principale
Inicio|Home|Accueil
Resultados|Scores|Résultats
Clasificación|Standings|Classement
Estadísticas|Stats|Statistiques
Noticias|News|Actualités
Fichajes|Transfers|Transferts
Cerrar|Close|Fermer
Abrir menú|Open menu|Ouvrir le menu
Cambiar tema|Change theme|Changer de thème
MARCADORES|SCORES|SCORES
Marcadores en directo|Live scores|Scores en direct
Cargando marcadores…|Loading scores…|Chargement des scores…
LIGAS Y COPAS · DATOS EN TIEMPO REAL|LEAGUES AND CUPS · LIVE DATA|CHAMPIONNATS ET COUPES · DONNÉES EN DIRECT
EL FÚTBOL|FOOTBALL|LE FOOTBALL
NO SE PARA.|NEVER STOPS.|NE S’ARRÊTE PAS.
Marcadores en directo, estadísticas de cada partido, clasificación oficial, goleadores, noticias y mercado de fichajes. Actualizado automáticamente.|Live scores, match statistics, standings, scorers, news and transfers. Updated automatically.|Scores en direct, statistiques des matchs, classements, buteurs, actualités et transferts. Mise à jour automatique.
Ver partidos|View matches|Voir les matchs
Cambiar competición|Change competition|Changer de compétition
Actualizado|Updated|Mis à jour
en directo|live|en direct
PARTIDOS HOY|TODAY’S MATCHES|MATCHS DU JOUR
LÍDER|LEADER|LEADER
PICHICHI|TOP SCORER|MEILLEUR BUTEUR
GOLES DEL DÍA|GOALS TODAY|BUTS DU JOUR
RESULTADOS|SCORES|RÉSULTATS
EN DIRECTO|LIVE|EN DIRECT
Actualizar|Refresh|Actualiser
Actualizar ahora|Refresh now|Actualiser maintenant
Fechas|Dates|Dates
Filtrar por estado|Filter by status|Filtrer par statut
Todos|All|Tous
En directo|Live|En direct
Finalizados|Finished|Terminés
Próximos|Upcoming|À venir
Mis equipos|My teams|Mes équipes
LA CARRERA|THE RACE|LA COURSE
CLASIFICACIÓN|STANDINGS|CLASSEMENT
Clasificación de jugadores|Player rankings|Classement des joueurs
Actualización automática cada 30 s|Automatically refreshes every 30 s|Actualisation automatique toutes les 30 s
DESCANSO|HALF TIME|MI-TEMPS
FINAL|FULL TIME|TERMINÉ
EN JUEGO|IN PLAY|EN COURS
Sin partidos|No matches|Aucun match
Cargando…|Loading…|Chargement…
No disponible|Unavailable|Indisponible
Sin conexión|Offline|Hors connexion
NOTICIAS|NEWS|ACTUALITÉS
FICHAJES|TRANSFERS|TRANSFERTS
HERRAMIENTAS|FOOTBALL|OUTILS DE
DE FÚTBOL|TOOLS|FOOTBALL
Herramientas Plus|Plus tools|Outils Plus
ARCHIVO DE COMPETICIONES|COMPETITION ARCHIVE|ARCHIVES DES COMPÉTITIONS
Toda la competición|Whole competition|Toute la compétition
Consultando temporadas en ESPN…|Loading seasons from ESPN…|Chargement des saisons ESPN…
Consultando la tabla de ESPN…|Loading ESPN standings…|Chargement du classement ESPN…
No se pudo consultar la tabla de ESPN.|Could not load ESPN standings.|Impossible de consulter le classement ESPN.
Fichajes y renovaciones|Transfers and renewals|Transferts et prolongations
En el radar|On the radar|Dans le viseur
Últimos movimientos|Latest activity|Derniers mouvements
● CONFIRMADO|● CONFIRMED|● CONFIRMÉ
● RUMOR|● RUMOUR|● RUMEUR
● SEGUIMIENTO|● WATCH|● SUIVI
El fútbol, a tu manera.|Football your way.|Le football à votre façon.
No hay movimientos recientes en esta categoría.|No recent activity in this category.|Aucun mouvement récent dans cette catégorie.
CLUB|CLUB|CLUB
Buscar equipo…|Search for a team…|Rechercher une équipe…
Buscar equipo|Search teams|Rechercher une équipe
Descenso|Relegation|Relégation
LOS NÚMEROS|THE NUMBERS|LES CHIFFRES
LÍDERES|STATISTICAL|MEILLEURES
ESTADÍSTICOS|LEADERS|STATISTIQUES
Máximos goleadores|Top scorers|Meilleurs buteurs
Máximos asistentes|Top assist providers|Meilleurs passeurs
Goles a favor vs. en contra|Goals for vs. against|Buts marqués et encaissés
TOP 10 DE LA CLASIFICACIÓN|STANDINGS TOP 10|TOP 10 DU CLASSEMENT
Goles a favor|Goals for|Buts marqués
Goles en contra|Goals against|Buts encaissés
Sin datos|No data|Aucune donnée
Aún no hay estadísticas disponibles.|Statistics are not available yet.|Les statistiques ne sont pas encore disponibles.
Estadísticas no disponibles|Statistics unavailable|Statistiques indisponibles
No se pudieron cargar los líderes de la temporada.|Could not load the season leaders.|Impossible de charger les leaders de la saison.
Leer en ESPN ↗|Read on ESPN ↗|Lire sur ESPN ↗
Ver más noticias|More news|Plus d’actualités
Reintentar|Try again|Réessayer
Competición|Competition|Compétition
Temporada|Season|Saison
Ordenar por|Sort by|Trier par
Jugador|Player|Joueur
Jugador 1|Player 1|Joueur 1
Jugador 2|Player 2|Joueur 2
CARA A CARA|HEAD TO HEAD|FACE-À-FACE
RENDIMIENTO INDIVIDUAL|INDIVIDUAL PERFORMANCE|PERFORMANCE INDIVIDUELLE
Pizarra táctica|Tactics board|Tableau tactique
Estadísticas avanzadas|Advanced statistics|Statistiques avancées
Comparador de jugadores|Player comparison|Comparateur de joueurs
Clasificaciones históricas|Historical standings|Classements historiques
Plantilla|Squad|Effectif
Guardar alineación|Save lineup|Enregistrer la composition
Restablecer|Reset|Réinitialiser
Formación|Formation|Formation
Cambiar|Change|Changer
Busca y elige a dos futbolistas para empezar.|Search for and select two players to get started.|Recherchez et sélectionnez deux joueurs pour commencer.
Elige dos futbolistas distintos.|Choose two different players.|Choisissez deux joueurs différents.
Consultando fichas y estadísticas de ESPN…|Loading ESPN profiles and statistics…|Chargement des fiches et statistiques ESPN…
Los dos jugadores se comparan en la misma competición y temporada. La edad mostrada es la actual, no la de la temporada elegida.|Both players are compared in the same competition and season. The age shown is their current age.|Les joueurs sont comparés dans la même compétition et saison. L’âge affiché est leur âge actuel.
Elige una competición|Choose a competition|Choisir une compétition
Elige competición|Choose a competition|Choisir une compétition
Buscar competición…|Search competitions…|Rechercher une compétition…
Buscar competición|Search competitions|Rechercher une compétition
‹ Ver competiciones|‹ View competitions|‹ Voir les compétitions
Elegir equipo favorito|Choose a favorite team|Choisir une équipe favorite
Iniciar sesión|Sign in|Se connecter
Registrarse|Sign up|S’inscrire
Bienvenido de nuevo|Welcome back|Bon retour
Usuario o correo|Username or email|Identifiant ou e-mail
Correo electrónico|Email|E-mail
Contraseña|Password|Mot de passe
Contraseña actual|Current password|Mot de passe actuel
Nueva contraseña|New password|Nouveau mot de passe
Recordarme|Remember me|Se souvenir de moi
Cambiar contraseña|Change password|Changer le mot de passe
Guardar nueva contraseña|Save new password|Enregistrer le nouveau mot de passe
No podemos enviar correos desde una cuenta local. Para cambiar tu contraseña, introduce la actual.|Local accounts do not send email. Enter your current password to change it.|Un compte local n’envoie pas d’e-mail. Saisissez votre mot de passe actuel pour le modifier.
Inicia sesión para guardar tus equipos favoritos y recibir avisos de goles.|Sign in to save your favorite teams and get goal alerts.|Connectez-vous pour suivre vos équipes favorites et recevoir les alertes de buts.
Usuario, correo o contraseña incorrectos.|Incorrect username, email or password.|Identifiant, e-mail ou mot de passe incorrect.
Escribe tu usuario o correo.|Enter your username or email.|Saisissez votre identifiant ou e-mail.
Escribe tu contraseña.|Enter your password.|Saisissez votre mot de passe.
Escribe tu contraseña actual.|Enter your current password.|Saisissez votre mot de passe actuel.
¿No tienes cuenta?|Don’t have an account?|Vous n’avez pas de compte ?
Regístrate gratis|Sign up for free|Inscrivez-vous gratuitement
Crea tu cuenta|Create an account|Créer un compte
Crear cuenta|Create account|Créer un compte
Crea un perfil local. No se sincroniza con la APK ni con otros dispositivos. No reutilices una contraseña de otro sitio.|Create a local profile. It doesn’t sync with other devices or the Android app. Use a password unique to this site.|Créez un profil local. Il n’est pas synchronisé avec d’autres appareils ni avec l’application Android. Utilisez un mot de passe unique.
Nombre|Name|Nom
Tu nombre|Your name|Votre nom
Usuario|Username|Identifiant
Ver|Show|Afficher
Ocultar|Hide|Masquer
Mostrar contraseña|Show password|Afficher le mot de passe
Repetir contraseña|Repeat password|Répéter le mot de passe
Repite la contraseña|Repeat the password|Répétez le mot de passe
Mínimo 8 caracteres|At least 8 characters|Au moins 8 caractères
Mínimo 8 caracteres.|At least 8 characters.|Au moins 8 caractères.
Las contraseñas no coinciden.|The passwords do not match.|Les mots de passe ne correspondent pas.
¿Ya tienes cuenta?|Already have an account?|Vous avez déjà un compte ?
Inicia sesión|Sign in|Connectez-vous
Mi perfil|My profile|Mon profil
Miembro desde|Member since|Membre depuis
Guardar cambios|Save changes|Enregistrer les modifications
Cerrar sesión|Sign out|Se déconnecter
Eliminar mi cuenta|Delete my account|Supprimer mon compte
Procesando…|Working…|Traitement…
Perfil actualizado.|Profile updated.|Profil mis à jour.
Has cerrado sesión.|Signed out.|Déconnexion réussie.
Limitar las notificaciones del dispositivo a mis equipos|Limit device notifications to my teams|Limiter les notifications de l’appareil à mes équipes
El boletín no está disponible en esta versión|The newsletter is not available in this version|La newsletter n’est pas disponible dans cette version
Configurar cookies|Cookie settings|Réglages des cookies
Usamos cookies|Browser storage|Stockage du navigateur
Aviso de cookies|Browser storage notice|Avis de stockage du navigateur
Usamos el almacenamiento del navegador para que funcione tu perfil local y, si lo permites, para recordar preferencias y contar visitas a las secciones. Tu elección se guarda en este navegador.|We use browser storage for your local profile and, if allowed, to remember preferences and count section visits. Your choice is stored in this browser.|Le stockage du navigateur sert au profil local et, si vous l’autorisez, à mémoriser les préférences et compter les visites. Votre choix reste dans ce navigateur.
Más información|Learn more|En savoir plus
Configurar|Configure|Configurer
Rechazar|Reject|Refuser
Aceptar todas|Accept all|Tout accepter
Preferencias de cookies|Storage preferences|Préférences de stockage
Necesarias|Essential|Essentielles
Preferencias|Preferences|Préférences
Recuerdan la competición y los cambios hechos en la navegación. Lo que elijas explícitamente en Ajustes se guarda aparte.|Remembers your competition and choices made while browsing. Changes you explicitly make in Settings are stored separately.|Mémorise la compétition et les choix faits pendant la navigation. Les modifications effectuées dans les réglages sont enregistrées séparément.
Analíticas locales|Local analytics|Statistiques locales
Rechazar opcionales|Reject optional|Refuser les options
Guardar preferencias|Save preferences|Enregistrer les préférences
Política de privacidad|Privacy policy|Politique de confidentialité
Política de cookies|Browser storage policy|Politique de stockage
Aviso legal|Legal notice|Mentions légales
política de privacidad|privacy policy|politique de confidentialité
aviso legal|legal notice|mentions légales
¡GOL!|GOAL!|BUT !
`;
  for (const row of rows.trim().split('\n')) {
    const [key, en, fr] = row.split('|');
    table.set(key, { en, fr });
  }
  const countries = {
    Norway: 'NO', Argentina: 'AR', Brazil: 'BR', France: 'FR', Spain: 'ES', Germany: 'DE', Portugal: 'PT',
    'United States': 'US', Mexico: 'MX', Belgium: 'BE', Netherlands: 'NL', Italy: 'IT', Colombia: 'CO',
    Morocco: 'MA', Japan: 'JP', Egypt: 'EG', Canada: 'CA', Uruguay: 'UY', Croatia: 'HR', Senegal: 'SN',
    England: 'GB-ENG', Scotland: 'GB-SCT', Wales: 'GB-WLS'
  };
  function country(value) {
    if (lang === 'en') return value;
    const special = { England: { es: 'Inglaterra', fr: 'Angleterre' }, Scotland: { es: 'Escocia', fr: 'Écosse' }, Wales: { es: 'Gales', fr: 'Pays de Galles' } };
    if (special[value]) return special[value][lang];
    return countries[value] && typeof Intl.DisplayNames === 'function' ? new Intl.DisplayNames(lang, { type: 'region' }).of(countries[value]) : value;
  }
  function t(text) {
    if (lang === 'es' || typeof text !== 'string') return text;
    const trimmed = text.trim();
    const translated = table.get(trimmed)?.[lang];
    return translated ? text.replace(trimmed, translated) : text;
  }
  function textNode(node) {
    if (!node.parentElement?.closest('script,style,textarea,#fgRumourHeading,#fgRumourBody,[data-fg-tip],#fgPlayerTitle,.news-card')) {
      const translated = t(node.nodeValue);
      if (translated !== node.nodeValue) node.nodeValue = translated;
    }
  }
  const attributes = ['aria-label', 'title', 'placeholder'];
  function walk(node) {
    if (node.nodeType === 3) return textNode(node);
    if (node.nodeType !== 1) return;
    const elements = [node, ...node.querySelectorAll('[aria-label],[title],[placeholder]')];
    elements.forEach((item) => attributes.forEach((name) => {
      const value = item.getAttribute(name);
      const translated = t(value);
      if (translated !== value) item.setAttribute(name, translated);
    }));
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) textNode(walker.currentNode);
  }
  function set(value) {
    if (value === lang || !['es', 'en', 'fr'].includes(value)) return;
    if (!store.set('fg_language', value)) return;
    store.set('fg_reopen_settings', true, 'session');
    location.reload();
  }
  FF.i18n = { t, lang, set, country };
  document.documentElement.lang = lang;
  if (lang !== 'es') {
    document.title = lang === 'en' ? 'FGFootBall Plus | Live football' : 'FGFootBall Plus | Football en direct';
    walk(document.body);
    new MutationObserver((records) => {
      records.forEach((record) => {
        if (record.type === 'attributes') {
          const value = record.target.getAttribute(record.attributeName);
          const translated = t(value);
          if (translated !== value) record.target.setAttribute(record.attributeName, translated);
        } else if (record.type === 'characterData') textNode(record.target);
        else record.addedNodes.forEach(walk);
      });
    }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: attributes });
  }
})(window.FF);
