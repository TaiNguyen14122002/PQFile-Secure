import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { BadRequestException, RequestMethod } from '@nestjs/common';
import { DocumentBuilder,SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { ApiErrorFilter } from './common/api-error.filter';
async function bootstrap(){
 const app=await NestFactory.create(AppModule,{rawBody:false});
 app.setGlobalPrefix('api');
 app.useGlobalFilters(new ApiErrorFilter());
 app.enableShutdownHooks();
 app.use((req:any,res:any,next:any)=>{
    // Same-origin browser writes only; local dev origin is configured in .env.
    const origin=req.headers.origin;
    const allowed=process.env.PUBLIC_BASE_URL||'http://localhost:8080';
    if(origin && origin!==allowed && !['GET','HEAD','OPTIONS'].includes(req.method))return res.status(403).json({message:'Origin không được phép'});
    next();
 });
 const config=new DocumentBuilder().setTitle('PQFile Secure API').setDescription('MVP API — phiên và ciphertext').setVersion('0.2').build();
 SwaggerModule.setup('api/docs',app,SwaggerModule.createDocument(app,config));
 await app.listen(Number(process.env.PORT||4000),'0.0.0.0');
}
bootstrap().catch(error => {
 console.error('[PQFile API] Startup failed. Check database initialization and service logs.');
 console.error(error instanceof Error ? error.stack : String(error));
 process.exit(1);
});
