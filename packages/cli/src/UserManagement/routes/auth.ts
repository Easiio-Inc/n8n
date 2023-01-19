/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Request, Response } from 'express';
import { IDataObject } from 'n8n-workflow';
import * as Db from '@/Db';
import * as ResponseHelper from '@/ResponseHelper';
import { AUTH_COOKIE_NAME } from '@/constants';
import { issueCookie, resolveJwt } from '../auth/jwt';
import { N8nApp, PublicUser } from '../Interfaces';
import { compareHash, sanitizeUser } from '../UserManagementHelper';
import { User } from '@db/entities/User';
import type { LoginRequest, SflowLoginRequest } from '@/requests';
import config from '@/config';

export function authenticationMethods(this: N8nApp): void {
	/**
	 * Log in a sflow user.
	 *
	 * Authless endpoint.
	 */
	this.app.post(
		`/${this.restEndpoint}/sflowauth`,
		ResponseHelper.send(async (req: SflowLoginRequest, res: Response): Promise<PublicUser> => {
			const { apikey, userid } = req.body;
			if (!apikey) {
				throw new Error('API Key is required to authorize Sflow request');
			}
			if (config.getEnv('sflowApi.apiKey') !== apikey) {
				throw new Error('API Key is invalid');
			}
			if (!userid) {
				throw new Error('UserID is required to log in');
			}

			let user: User | undefined;
			try {
				user = await Db.collections.User.findOne(
					{ id: userid },
					{
						relations: ['globalRole'],
					},
				);
			} catch (error) {
				throw new Error('Unable to access database.');
			}

			if (!user) {
				const error = new Error('UserID is not found, please check it again.');
				// @ts-ignore
				error.httpStatusCode = 404;
				throw error;
			}

			await issueCookie(res, user);

			return sanitizeUser(user);
		}),
	);

	/**
	 * Log in a user.
	 *
	 * Authless endpoint.
	 */
	this.app.post(
		`/${this.restEndpoint}/login`,
		ResponseHelper.send(async (req: LoginRequest, res: Response): Promise<PublicUser> => {
			const { email, password } = req.body;
			if (!email) {
				throw new Error('Email is required to log in');
			}

			if (!password) {
				throw new Error('Password is required to log in');
			}

			let user: User | null;
			try {
				user = await Db.collections.User.findOne({
					where: { email },
					relations: ['globalRole'],
				});
			} catch (error) {
				throw new Error('Unable to access database.');
			}

			if (!user?.password || !(await compareHash(req.body.password, user.password))) {
				throw new ResponseHelper.AuthError('Wrong username or password. Do you have caps lock on?');
			}

			await issueCookie(res, user);

			return sanitizeUser(user);
		}),
	);

	/**
	 * Manually check the `n8n-auth` cookie.
	 */
	this.app.get(
		`/${this.restEndpoint}/login`,
		ResponseHelper.send(async (req: Request, res: Response): Promise<PublicUser> => {
			// Manually check the existing cookie.
			const cookieContents = req.cookies?.[AUTH_COOKIE_NAME] as string | undefined;

			let user: User;
			if (cookieContents) {
				// If logged in, return user
				try {
					user = await resolveJwt(cookieContents);
					return sanitizeUser(user);
				} catch (error) {
					res.clearCookie(AUTH_COOKIE_NAME);
				}
			}

			if (config.get('userManagement.isInstanceOwnerSetUp')) {
				throw new ResponseHelper.AuthError('Not logged in');
			}

			try {
				user = await Db.collections.User.findOneOrFail({ relations: ['globalRole'], where: {} });
			} catch (error) {
				throw new ResponseHelper.InternalServerError(
					'No users found in database - did you wipe the users table? Create at least one user.',
				);
			}

			if (user.email || user.password) {
				throw new ResponseHelper.InternalServerError(
					'Invalid database state - user has password set.',
				);
			}

			await issueCookie(res, user);

			return sanitizeUser(user);
		}),
	);

	/**
	 * Log out a user.
	 *
	 * Authless endpoint.
	 */
	this.app.post(
		`/${this.restEndpoint}/logout`,
		ResponseHelper.send(async (_, res: Response): Promise<IDataObject> => {
			res.clearCookie(AUTH_COOKIE_NAME);
			return {
				loggedOut: true,
			};
		}),
	);
}
