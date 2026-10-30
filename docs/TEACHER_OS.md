# Teacher OS y cuentas de alumno

## Rutas
| Ruta | Quién | Qué |
|---|---|---|
| `/registro` | público | Crear cuenta de **alumno**: alias + contraseña + confirmación. Nada más. |
| `/entrar` | público | Iniciar sesión. Enlace «Crear cuenta» y acceso «Unirse a una clase». |
| `/jugar`, `/p/CÓDIGO` | público | **Unirse a una clase** con el código de sala, como siempre (con o sin cuenta). |
| `/mi` | alumno | Espacio personal: continuar, 4 juegos, temas a repasar (incl. los asignados por el profe), retos semanales, progreso, clases y actividades. |
| `/cuenta` | alumno | Progreso detallado, logros, ranking (opcional), cambiar contraseña, cerrar sesión, borrar cuenta. |
| `/teacher` (alias `/profesor`) | profesor | **Teacher OS**: Übersicht · Schüler · Unterricht · Analyse · Bibliothek · Einstellungen. |

La navegación pública ofrece **«Crear cuenta»** como llamada principal, **«Iniciar sesión»** y **«Unirse a una clase»**. El antiguo «Entrar» (que abría la cuenta) ya no existe; unirse a una clase nunca dependió de él y no ha cambiado.

## Roles y autenticación
- **Alumno**: registro público (solo rol alumno). Contraseña con scrypt + sal propia. Sesión = token de 256 bits en una **cookie HttpOnly `dt_s`** (SameSite=Lax, Secure tras HTTPS); el servidor solo guarda su hash. El navegador guarda únicamente un indicador «hay sesión», nunca el token.
- **Profesor**: **no hay registro público**. Las claves se emiten en privado en el servidor (`npm run teacher -- add "Nombre"` · `list` · `revoke <id>`), se guardan con hash salado y se canjean en `/teacher` por una **cookie HttpOnly `dt_t`** de 12 h. Revocar la clave corta sus sesiones.
- **Separación**: una sesión de alumno nunca vale como profesor (ni por cookie, ni por cabecera, ni en el WebSocket) y una clave/sesión de profesor nunca vale como alumno.
- **Autorización en el servidor**: toda ruta `/api/teacher/*` (salvo login) comprueba la sesión de profesor en cada petición. **Fail-closed**: sin profesores registrados, Teacher OS no admite a nadie (503).
- **CSRF**: toda petición que cambia algo con cookie debe ser JSON del mismo origen.
- **TEACHER_AUTH=required** sigue cerrado: crear salas de profesor exige clave o sesión de Teacher OS. La sesión viaja también en el WebSocket (cookie), así que «Iniciar clase» desde Teacher OS crea la sala sin que el navegador conozca ninguna clave.

## Teacher OS
- **Übersicht**: alumnos, activos (7 días), actividades, clases; evolución del grupo (volumen + precisión, con n); temas con más errores (solo con ≥ 20 respuestas); «necesita atención» (hechos: inactividad, precisión baja en sus últimas respuestas, cuenta sin usar — nunca etiquetas sobre la persona); respuestas abiertas por revisar en salas en directo; próximas clases; salas en directo. Estados vacíos sin datos inventados.
- **Schüler**: lista con filtros (texto, grupo, nivel); **alta de alumnos** con contraseña temporal mostrada una vez; grupos; ficha con pestañas **Übersicht** (resumen, errores recurrentes, asignar repaso, restablecer contraseña, desactivar/reactivar), **Fortschritt** (12 semanas), **Grammatik** (por tema **y por dificultad**, con n), **Aktivitäten**, **Lehrernotizen** (notas privadas y asistencia). Pestañas accesibles por teclado.
- **Unterricht**: planificar clase (título, fecha, grupo o alumnos, juego, temas, dificultad, presentación); **Iniciar** crea la sala con el sistema de siempre (código, Chromebooks) y la vincula; recuperar la sala; terminar; resultados por alumno.
- **Analyse**: estadística **descriptiva** con filtros (período, alumno, tema, dificultad): por día, franja horaria, tema, dificultad y tipo de actividad. Cada valor con su n; por debajo de 20, «Datos insuficientes» y barra rayada. Sin modelos predictivos.
- **Bibliothek**: 8 presentaciones reales (de `catalogo.json`), juegos, examen Road to B1, taller y repasos por tema; filtros por nivel, tema y tipo; «Abrir» y «Lanzar en clase».
- **Einstellungen**: nombre de la academia, profesores, modo de acceso y resumen de privacidad.

Datos privados de la academia en `DATA_DIR/teacher-data.json` (0600): niveles, grupos, notas, asistencia, repasos y clases. Todos los profesores de la academia ven a todos los alumnos (una sola academia).

## Privacidad (alumnado menor)
- Sin correo, nombre real ni fecha de nacimiento. El profesor da de alta con alias.
- Notas y asistencia **solo** para profesores (probado: ninguna ruta de alumno ni pública las devuelve).
- El alumno ve de la academia solo lo suyo: nivel, repasos asignados, sus grupos y sus clases.
- Ranking opcional, desactivado por defecto, solo alias y puntos.
- Contraseña olvidada: el profesor la restablece (contraseña temporal; cierra las sesiones del alumno).
- Baja: el alumno borra su cuenta (progreso y datos de la academia incluidos).

## Juegos en modo libre (estado real)
BlackCard, Wort-Jenga y Boxeo: solo y sala privada, implementados y probados. **Deutsch Deck no existe** y se muestra como «Próximamente».

## Limitaciones conocidas
- Una sola academia; no hay permisos distintos entre profesores.
- La importación masiva de alumnos (CSV) no existe; se dan de alta uno a uno o se registran solos.
- «Requiere revisión» cubre respuestas abiertas de salas en directo; no hay cola de revisión de tareas asíncronas.
- No hay calendario con horas ni notificaciones; las clases se planifican por fecha.
- El análisis es descriptivo y por respuestas de alumnos con cuenta; los invitados no aparecen.
