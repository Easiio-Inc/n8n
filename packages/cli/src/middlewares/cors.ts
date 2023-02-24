import type { RequestHandler } from 'express';

export const corsMiddleware: RequestHandler = (req, res, next) => {
	if ('origin' in req.headers) {
		// Allow access also from frontend when developing
		// Allow access from sf.easiio.cn, *.sflow.io, *.sflow.pro, *.sflow.cc
		const allowedOrigins = [
			'http://127.0.0.1:8080',
			'http://localhost:8080',
			'http://127.0.0.1:8083',
			'http://localhost:8083',
			'https://sf.easiio.cn',
		];
		const origin = req.headers.origin ?? '';
		if (
			allowedOrigins.indexOf(origin) > -1 ||
			origin.indexOf('sflow.io') > -1 ||
			origin.indexOf('sflow.pro') > -1 ||
			origin.indexOf('sflow.cc') > -1 ||
			origin.indexOf('worksapp.com') > -1
		) {
			res.header('Access-Control-Allow-Origin', req.headers.origin);
		}
		res.header('Access-Control-Allow-Credentials', 'true');
		res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
		res.header(
			'Access-Control-Allow-Headers',
			'Origin, X-Requested-With, Content-Type, Accept, sessionid',
		);
	}

	if (req.method === 'OPTIONS') {
		res.writeHead(204).end();
	} else {
		next();
	}
};
