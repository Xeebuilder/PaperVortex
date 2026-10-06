import smtplib
import time
import random
import csv
import os
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

# ============================================================
# CONFIGURACIÓN DE TU CUENTA (Maximiliano Rodriguez / Paper Vortex Studios)
# ============================================================
# Tu dirección de Gmail
GMAIL_USER = "maxrsilvagni@gmail.com"

# Tu contraseña de aplicación de 16 letras de Google (configurar como variable de entorno o aquí)
GMAIL_APP_PASSWORD = os.getenv("GMAIL_APP_PASSWORD", "YOUR_GOOGLE_APP_PASSWORD")

# Idioma de los correos: "ES" para Español, "EN" para Inglés
IDIOMA = "ES"

# ============================================================
# PLANTILLAS DE CORREO
# ============================================================
TEMPLATES = {
    "ES": {
        "subject": "Asistente de IA para tus propiedades en WhatsApp (1 semana gratis)",
        "body": """Hola {nombre},

Soy Maximiliano Rodriguez de Paper Vortex Studios.

Desarrollamos asistentes de Inteligencia Artificial que se conectan directamente a páginas web inmobiliarias para atender prospectos por WhatsApp 24/7.

A diferencia de un bot tradicional, este sistema no da respuestas vagas ni genéricas: lee la página web de la empresa y responde con detalles exactos de las propiedades (si es venta o alquiler, cantidad de cuartos, metraje, precios, zonas, cuotas de mantenimiento y financiamiento). Además, califica el presupuesto del cliente antes de pasártelo listo para agendar.

Estamos ofreciendo la primera semana 100% gratis de prueba directamente en tu número de WhatsApp, sin tarjetas ni compromisos de por medio.

¿A qué número de WhatsApp o correo te puedo enviar un video de 30 segundos mostrando cómo funciona?

Saludos cordiales,
Maximiliano Rodriguez
Paper Vortex Studios
"""
    },
    "EN": {
        "subject": "AI WhatsApp assistant for your real estate listings (1 week free)",
        "body": """Hi {nombre},

I'm Maximiliano Rodriguez from Paper Vortex Studios.

We build AI assistants that connect directly to real estate websites to handle client inquiries on WhatsApp 24/7.

Unlike traditional bots, this system doesn't give vague replies: it reads your website and provides exact property details (whether it's for sale or rent, number of bedrooms, square footage, prices, areas, HOA fees, and financing terms), while qualifying the buyer's budget before handing them over to you.

We are currently offering a 1-week 100% free trial directly on your WhatsApp line, with no commitments or setup fees.

What is the best number or email where I can send you a quick 30-second video demo of how it works?

Best regards,
Maximiliano Rodriguez
Paper Vortex Studios
"""
    }
}

def send_campaign():
    csv_file = "recipients.csv"

    if not os.path.exists(csv_file):
        print(f"❌ Error: No se encontró el archivo '{csv_file}'. Créalo con tu lista de correos.")
        return

    tpl = TEMPLATES.get(IDIOMA.upper(), TEMPLATES["ES"])

    with open(csv_file, mode='r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        recipients = list(reader)

    total = len(recipients)
    if total == 0:
        print("⚠️ El archivo recipients.csv está vacío.")
        return

    print(f"\n🚀 Iniciando envío de {total} correos en idioma [{IDIOMA}]...")
    print(f"Remitente: Maximiliano Rodriguez ({GMAIL_USER})")
    print("------------------------------------------------------------\n")

    try:
        server = smtplib.SMTP("smtp.gmail.com", 587)
        server.starttls()
        server.login(GMAIL_USER.strip(), GMAIL_APP_PASSWORD.replace(" ", "").strip())
    except Exception as e:
        print(f"❌ Error conectando a Gmail: {e}")
        print("Asegúrate de configurar GMAIL_USER y tu Contraseña de Aplicación de Google de 16 letras.")
        return

    enviados = 0
    for i, row in enumerate(recipients, 1):
        email_to = row.get("email", "").strip()
        nombre = row.get("nombre", "").strip() or ("there" if IDIOMA == "EN" else "")

        if not email_to or "@" not in email_to:
            print(f"[{i}/{total}] Saltando correo inválido: {email_to}")
            continue

        msg = MIMEMultipart()
        msg["From"] = f"Maximiliano Rodriguez - Paper Vortex Studios <{GMAIL_USER}>"
        msg["To"] = email_to
        msg["Subject"] = tpl["subject"]

        body_text = tpl["body"].format(nombre=nombre)
        msg.attach(MIMEText(body_text, "plain", "utf-8"))

        try:
            server.send_message(msg)
            enviados += 1
            print(f"✅ [{i}/{total}] Enviado a: {email_to} ({nombre})")
        except Exception as e:
            print(f"❌ [{i}/{total}] Error enviando a {email_to}: {e}")

        # Retraso aleatorio de seguridad para evitar filtros de spam de Gmail
        if i < total:
            delay = random.randint(25, 45)
            print(f"   ⏳ Esperando {delay} segundos antes del siguiente envío...")
            time.sleep(delay)

    server.quit()
    print("\n============================================================")
    print(f"🎉 ¡Campaña finalizada con éxito! Total enviados: {enviados}/{total}")
    print("============================================================\n")

if __name__ == "__main__":
    send_campaign()
