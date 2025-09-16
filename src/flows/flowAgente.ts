import { addKeyword, addAnswer } from '@builderbot/bot'


const FlowAgente = addKeyword(['4', 'Agente', 'AGENTE'])
.addAnswer(["*Estamos desviando tu conversacion a nuestro agente*"], null,
   async(ctx, {provider, endFlow}) => {
    console.log('ctx', ctx.key?.remoteJid)
    const name = ctx.pushName;
    const numAgente = ctx.key?.remoteJid;
    const message = `El cliente ${name} con el celular ${numAgente} solicita atencion mas personalizada`;
    const refProvider = await provider.getInstance();
    provider.sendText('56936499908@s.whatsapp.net', message)
       return endFlow('*Gracias*');
   }
);

module.exports = FlowAgente