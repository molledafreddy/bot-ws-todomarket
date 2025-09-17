import { join } from 'path'
import { createBot, createProvider, createFlow, addKeyword, utils, EVENTS } from '@builderbot/bot'
import { MongoAdapter as Database } from '@builderbot/database-mongo'
import { BaileysProvider as Provider } from '@builderbot/provider-baileys'
import moment  from "moment";
import { idleFlow, reset, start, stop, IDLETIME } from './idle-custom'


const PORT = process.env.PORT ?? 3009

const finalFlow = addKeyword<Provider, Database>(EVENTS.ACTION)
    .addAction(
        async (_, { endFlow }) => {
            return endFlow('End by inactivity')
        }
    )

const registerFlow = addKeyword<Provider, Database>(utils.setEvent('REGISTER_FLOW'))
    .addAnswer(`What is your name?`, { capture: true }, async (ctx, { state }) => {
        await state.update({ name: ctx.body })
    })
    .addAnswer('What is your age?', { capture: true }, async (ctx, { state }) => {
        await state.update({ age: ctx.body })
    })
    .addAction(async (_, { flowDynamic, state }) => {
        await flowDynamic(`${state.get('name')}, thanks for your information!: Your age: ${state.get('age')}`)
    })


//  const flowLink = addKeyword(['2', 'Link', 'link'])
//  .addAnswer(
//     [
//         'En el siguiente Link tendras la opcion de realizar El pedido de los productos que desees:',
//         'Si tienes dudas con el flujo de compra comunicate con un Agente para recibir intrucciones', 
//         'Para comunicarte con un Agente escribe la palabra *Hola* Luego en numero #*4* Opciones que permitira que un agente se comunique a tu numero.', 
//         '🔗 *https://www.almacenesdigitales.cl/Ecommerce.xhtml?almacen=4361*', 
//     ],
//     null,
//      (ctx,{ endFlow }) => {  return endFlow('Gracias'); }
//  );

const FlowAgente2 = addKeyword(['2', 'Agente', 'AGENTE'])
.addAnswer(["*Estamos desviando tu conversacion a nuestro Agente*"], null,
   async(ctx, {provider, endFlow}) => {
    const name = ctx?.pushName;
    const numAgente = ctx?.from;
    const message = `El cliente ${name} con el celular ${numAgente} solicita atencion personalizada`;

    const jid = ctx.key.remoteJid
    await provider.vendor.presenceSubscribe(jid)
    await provider.vendor.sendPresenceUpdate('composing', jid);
    await provider.vendor.readMessages([ctx.key])
    await provider.sendText('56936499908@s.whatsapp.net', message)
    return endFlow('*Gracias*');
   }
);

/**
* captura una variedad de eventos que no son permitidos por el bot para enviar un mensaje correspondiente al caso.
*/
 const flowValidMedia = addKeyword([EVENTS.MEDIA, EVENTS.VOICE_NOTE, EVENTS.LOCATION, EVENTS.DOCUMENT])
 .addAction(async(ctx,{gotoFlow, flowDynamic}) => {
    try {
            console.log('ctx dentro de flowValidMedia', ctx.message)
            if (
                ctx.message && Object.prototype.hasOwnProperty.call(ctx.message, 'imageMessage') ||
                ctx.message && Object.prototype.hasOwnProperty.call(ctx.message, 'audioMessage') ||
                ctx.message && Object.prototype.hasOwnProperty.call(ctx.message, 'locationMessage') ||
                ctx.message && Object.prototype.hasOwnProperty.call(ctx.message, 'documentMessage')
            ) {
                // handle imageMessage case here if needed
                console.log('ctx INGRESO AL IF')
                await flowDynamic("❌  *Opcion no Valida*\n\n Por ahora solo es permitido enviar texto.")
                return gotoFlow(flowPrincipal); 
            } 
    } catch (error) {
        console.log('error Media', error)
    }
});

/**
* captura El evento que se genera cuando se recibe un pedido proveniente del carrito de compra.
*/
 const flowOrder = addKeyword([EVENTS.ORDER])
 .addAction(async(ctx,{gotoFlow, fallBack, provider, globalState}) => {
    try {
        const jid = ctx.key.remoteJid
        await provider.vendor.presenceSubscribe(jid)
        await provider.vendor.sendPresenceUpdate('composing', jid);
        await provider.vendor.readMessages([ctx.key])

         if (ctx?.message?.orderMessage) {
                 
            const orderId = ctx?.message?.orderMessage?.orderId;
            const ordertoken= ctx?.message?.orderMessage?.token;
            console.log('orderId', orderId)
            
            const details= await provider.vendor.getOrderDetails(orderId, ordertoken);
            const resultProcess = await processOrder(details)

                if (resultProcess.length > 0) { 
                    await globalState.update({ order: resultProcess })
                console.log(' Concretar Compra  Concretar Compra')
                return gotoFlow(flowEndShoppingCart);
            }
        }
    } catch (error) {
        console.log('error Media', error)
    }
});

const flowEndShoppingCart = addKeyword('direccion')
.addAnswer([
    'Su Pedido esta siendo procesado 🛒', 
    'Para seguir avanzado ingrese los siguientes datos:',
    
])
 .addAnswer(
    [
        'Direccion con la siguiente estructura:\n',
        '*Nombre Calle Numeracion, Comuna, Dto/Bloque/Lote Referencia*\n',
    ],
    { capture: true,  delay: 3000, idle: 960000 },
    async(ctx, {endFlow, provider, globalState}) => {
        const name = ctx.pushName;
        const phone = ctx.from;
        const jid = ctx.key.remoteJid

        await provider.vendor.presenceSubscribe(jid)
        await provider.vendor.sendPresenceUpdate('composing', jid);
        await provider.vendor.readMessages([ctx.key])
        

        if (ctx.body.length > 0) {
            await globalState.update({address: ctx.body})
            const dataOrder = globalState.get('order')
            const dataAddress = globalState.get('address')
            console.log('globalState dentro de flowEndShoppingCart', dataOrder)
            console.log('globalState dentro de flowEndShoppingCart', dataAddress)
            await notificationDelivery(dataOrder, dataAddress, name, phone, provider)
            return endFlow('Gracias por su Pedido, En breve nos comunicaremos con usted para coordinar la entrega.')
        } else {
            return endFlow('❌  *No se recibió información válida*\n\n Para Concretar la compra debe indicar su direccion con la estructura indicada');
        }
    }
 );


// const flowPrincipal = addKeyword("welcome")
const flowPrincipal = addKeyword<Provider, Database>(utils.setEvent('welcome'))
 .addAction(async (ctx, { gotoFlow }) => start(ctx, gotoFlow, IDLETIME))
//  .addAnswer(`You have ${IDLETIME / 1000} seconds to respond\n*Multiplication:*\n6 * 6 ?`)
 .addAnswer([
    '🏜️ Hola, Bienvenido a *Minimarket TodoMarket* 🌵', 
    '⌛ Horario disponible desde las 2:00 PM hasta las 10:00 PM. ⌛',
    '📝 a través de este canal te ofrecemos los siguientes servicios de compra:'
    
])
 .addAnswer(
     [
        '*Indica el Número de la opción que desees:*', 
        '👉 #1 Carrito de compra whatsApp', 
        '👉 #2 Conversar con un Agente', 
        // '👉 #3 Link Carrito de compra Web'
    ].join('\n'),
    { capture: true,  delay: 4000, idle: 960000 },
    async (ctx,{ provider, fallBack, gotoFlow, state}) => {
        const jid = ctx.key.remoteJid
        await provider.vendor.presenceSubscribe(jid)
        await provider.vendor.sendPresenceUpdate('composing', jid);
        await provider.vendor.readMessages([ctx.key])

        if (ctx.body.toLocaleLowerCase().includes('1')) {
            stop(ctx)
            const numAgente = ctx.key?.remoteJid;
            console.log('getCart', numAgente)
        
            await sendCatalog(provider, numAgente,{
                title: "Catalogo",
                message: "Mira todos nuestros productos aqui 👇🏼",
            });

            return
        }
   
        if (![1, 2, 3].includes(parseInt(ctx.body.toLowerCase().trim()))) {
            reset(ctx, gotoFlow, IDLETIME)
            return fallBack("*Opcion no valida*, \nPor favor seleccione una opcion valida.");
        }
     },
    [FlowAgente2]
 );

async function sendCatalog( provider: any, from: any, catalog: any) {
  const { title, body, message, image } = catalog || {};
//   let catalogPath = jid.split(":")[0];
// https://wa.me/c/56949079809
  return await provider.vendor.sendMessage(from, {
    text: message || "Mira todos nuestros productos aquí :point_down_tone2:",
    contextInfo: {
      externalAdReply: {
        title: title || "Catálogo",
        body: body || "Mira nuestros productos",
        mediaType: "VIDEO", // VIDEO - IMAGE - NONE
        // mediaUrl: `https://wa.me/c/${catalogPath}`,
        mediaUrl: `https://wa.me/c/56949079809`,
        thumbnailUrl: image || "https://github.com/Ameth1208/PortalQR/blob/main/resources/logo.png?raw=true",
        // sourceUrl: `https://wa.me/c/${catalogPath}`,
        sourceUrl: `https://wa.me/c/56949079809`,
      },
    },
  });
}

async function processOrder(details: any) {
    const containerProducts: any[] = [];
     containerProducts.push("*Productos Seleccionados*\n\n");
    const TotalAmount = details?.price?.total / 1000;
    const Products = details?.products || [];

    let counterGlobal = 1

    Products.forEach(element => {
        const valueG =`👉 #:${counterGlobal} Nombre: ${element.name} Cantidad:${element.quantity}  Precio:${(element.price / 1000)}\n`
        containerProducts.push(valueG)
        counterGlobal++;
    });
    containerProducts.push(`\nTotal a Pagar: ${TotalAmount}`)

    console.log('containerProducts dentro de  processOrder', containerProducts)
    return containerProducts;
}

async function notificationDelivery(order: any, address: any, name: any, phone: any, provider: any) {
    const  dataMessageGlobal: any[] = [];
    dataMessageGlobal.push(`* 🛒 Se registr nuevo pedido con Detalle: 🛒* \n`);
    dataMessageGlobal.push(`*Nombre Cliente:* ${name} \n *Telefono:* +${phone} \n`);
    dataMessageGlobal.push(`* Direccion:* ${address} \n`);
    dataMessageGlobal.push(order);

    await provider.sendText('56936499908@s.whatsapp.net', dataMessageGlobal.toString());
    
}




  /**
* Declarando flujo principal
*/
const flowDisable = addKeyword("disable")
.addAction(async (ctx, { gotoFlow }) => start(ctx, gotoFlow, IDLETIME))
.addAnswer([
   '🏜️ Hola, Bienvenido a *Minimarket TodoMarket* 🌵', 
   '⌛ Nuestra disponibilidad para atenderte esta desde las 12:00 PM hasta las 10:00 PM. ⌛'
])
.addAnswer(
    [
       '*Pero puedes ver nuestras redes sociales y recuerda que en el horario habilitado Empieza tu pedido escribiendo la palabra Hola*', 
       '👉 #1 Facebook', 
       '👉 #2 Instagram', 
       '👉 #3 TicTok'
    ],
    { capture: true,  delay: 2000, idle: 960000 },
    async (ctx,{ endFlow, fallBack, gotoFlow}) => {
        
        if (ctx.body === "1") {
             stop(ctx)
           return endFlow('En el siguiente Link tendras la opcion de ver Nuestra Pagina de Facebook\n 🔗 https://www.facebook.com/profile.php?id=61550250449208 \n*Gracias*');
        }
        
        if (ctx.body === "2") {
             stop(ctx)
            return endFlow('En el siguiente Link tendras la opcion de ver Nuestra Pagina de Instagram\n 🔗 https://instagram.com/minimarketlosmedanos?igshid=YTQwZjQ0NmI0OA== \n*Gracias*');
        }
        if (ctx.body === "3") {
             stop(ctx)
            return endFlow('En el siguiente Link tendras la opcion de ver Nuestro TikTok\n 🔗 https://vm.tiktok.com/ZMjkbTYBg/ \n*Gracias*');
        } 

        if (![1, 2, 3].includes(parseInt(ctx.body.toLowerCase().trim()))) {
            reset(ctx, gotoFlow, IDLETIME)
            return fallBack("*Opcion no valida*, \nPor favor seleccione una opcion valida.");
        }
    }
)


 const flowValidTime = addKeyword<Provider, Database>(EVENTS.WELCOME)
 .addAction(async(ctx,{gotoFlow, provider, state}) => {
     try {
        const refProvider = provider.getInstance();
        const jid = ctx.key.remoteJid
        await provider.vendor.presenceSubscribe(jid)
        await provider.vendor.sendPresenceUpdate('composing', jid);
        await provider.vendor.readMessages([ctx.key])

         await state.update({ name: ctx.body})

        const dataState = state.getMyState()
        const horaActual = moment();
        const horario = "09:00-24:00"
        const rangoHorario = horario.split("-");
        const horaInicio = moment(rangoHorario[0], "HH:mm");
        const horaFin = moment(rangoHorario[1], "HH:mm");
        //  console.log('Validando hora de Atencion',horaInicio)
        // if (horaActual.isBetween(horaInicio, horaFin)) {
            return gotoFlow(flowPrincipal); 
        // } else {
           
        //     return gotoFlow(flowPrincipal);
        // }

    } catch (error) {
        console.log('error flowValidTime', error)
    }
    
});

 // return gotoFlow(flowDisable);

const main = async () => {
    const adapterFlow = createFlow([flowValidTime, flowPrincipal,  flowOrder, flowEndShoppingCart, flowValidMedia, idleFlow])
    
    // const adapterProvider = createProvider(Provider)
    //     const adapterDB = new Database({
    //     dbUri: process.env.MONGO_DB_URI,
    //     dbName: process.env.MONGO_DB_NAME,
    // })

    const adapterProvider = createProvider(Provider)

    const adapterDB = new Database({
        dbUri: 'mongodb+srv://molledafreddy:magallanes2721.@cluster0.1e16p.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0',
        dbName: 'db_bot',
    })
    

    const { handleCtx, httpServer } = await createBot({
        flow: adapterFlow,
        provider: adapterProvider,
        database: adapterDB,
    })

    adapterProvider.server.post(
        '/v1/messages',
        handleCtx(async (bot, req, res) => {
            const { number, message, urlMedia } = req.body
            await bot.sendMessage(number, message, { media: urlMedia ?? null })
            return res.end('sended')
        })
    )

    adapterProvider.server.post(
        '/v1/register',
        handleCtx(async (bot, req, res) => {
            const { number, name } = req.body
            await bot.dispatch('REGISTER_FLOW', { from: number, name })
            return res.end('trigger')
        })
    )

    adapterProvider.server.post(
        '/v1/samples',
        handleCtx(async (bot, req, res) => {
            const { number, name } = req.body
            await bot.dispatch('SAMPLES', { from: number, name })
            return res.end('trigger')
        })
    )

    adapterProvider.server.post(
        '/v1/blacklist',
        handleCtx(async (bot, req, res) => {
            const { number, intent } = req.body
            if (intent === 'remove') bot.blacklist.remove(number)
            if (intent === 'add') bot.blacklist.add(number)

            res.writeHead(200, { 'Content-Type': 'application/json' })
            return res.end(JSON.stringify({ status: 'ok', number, intent }))
        })
    )

    httpServer(+PORT)
}

main()
