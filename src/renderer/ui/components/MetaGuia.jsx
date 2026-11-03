import React from 'react';
import { CheckCircle2, Info } from 'lucide-react';

const PASOS = [
  ['Cuenta de Meta Business', 'Entra a business.facebook.com con la cuenta de tu empresa. En Configuración del negocio > Centro de seguridad, verifica la empresa: sin eso el límite de contactos por día es bajo.'],
  ['App de Meta para desarrolladores', 'En developers.facebook.com crea una app de tipo «Empresa» y agrega el producto «WhatsApp».'],
  ['Cuenta y número de WhatsApp Business', 'Crea la cuenta de WhatsApp Business y registra el número que enviará las difusiones. Un número que hoy usas en la app del celular no se puede usar tal cual: confirma con Meta o tu proveedor si puede convivir con la app antes de moverlo.'],
  ['Datos de conexión', 'Anota el ID del número de teléfono y el ID de la cuenta de WhatsApp Business, y crea un token permanente desde un usuario del sistema (Configuración del negocio > Usuarios del sistema). Guárdalo como una contraseña.'],
  ['Webhook', 'En la configuración de WhatsApp de tu app, registra la URL pública (https) donde se recibirán las respuestas y suscríbete al campo «messages».'],
  ['Plantilla de mensaje', 'Una difusión es un mensaje que empiezas tú, y para eso Meta exige una plantilla aprobada. Créala en WhatsApp Manager (categoría Marketing) y espera su aprobación.'],
  ['Método de pago', 'Agrega una forma de pago a la cuenta de WhatsApp Business: los mensajes de marketing se cobran por mensaje entregado.'],
];

const VERIFICACION = [
  ['Número conectado', 'En WhatsApp Manager > Teléfonos, el número aparece como «Conectado» y con calidad alta (verde).'],
  ['Mensaje de prueba', 'En tu app de Meta, WhatsApp > Configuración de la API, envía la plantilla de prueba («hello_world») a tu propio número. Debe llegarte.'],
  ['Webhook verificado', 'En la configuración del webhook pulsa «Verificar y guardar»: debe aceptarlo sin error. Escríbele a ese número desde otro celular y comprueba que el evento llega a tu URL.'],
  ['Plantilla aprobada', 'En WhatsApp Manager > Plantillas, tu plantilla de marketing figura como «Aprobada».'],
  ['Límite de envío', 'En el panel del número revisa cuántos contactos distintos puedes escribir por día; sube a medida que envías con buena calidad y tienes la empresa verificada.'],
];

const Lista = ({ titulo, items, check }) => (
  <section>
    <h3 className="text-sm font-semibold mb-2">{titulo}</h3>
    <ol className="space-y-2">
      {items.map(([t, d], i) => (
        <li key={t} className="flex gap-3 text-sm">
          <span className="w-6 h-6 shrink-0 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center mt-0.5" aria-hidden="true">
            {check ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
          </span>
          <span><strong>{t}.</strong> <span className="text-muted-foreground">{d}</span></span>
        </li>
      ))}
    </ol>
  </section>
);

// Instructivo para enviar difusiones por la API oficial de Meta y cómo comprobar que quedó conectada.
export function MetaGuia() {
  return (
    <div className="space-y-5">
      <div role="note" className="flex gap-2 rounded-xl bg-primary/5 border border-primary/20 px-3 py-2 text-xs text-muted-foreground">
        <Info className="w-4 h-4 shrink-0 mt-0.5 text-primary" aria-hidden="true" />
        <span>
          <strong className="text-foreground">Esta versión de Emissary todavía no se conecta a Meta.</strong> Las difusiones se siguen enviando con tu WhatsApp vinculado.
          Esta guía es para dejar la cuenta de Meta lista. Los paneles de Meta cambian con frecuencia: confirma cada paso en su documentación oficial.
        </span>
      </div>
      <Lista titulo="Cómo conectarte a la API de Meta" items={PASOS} />
      <Lista titulo="Cómo verificar que la conexión con Meta funciona" items={VERIFICACION} check />
    </div>
  );
}
