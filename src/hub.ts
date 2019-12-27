import { createServer, Server, ServerOptions } from 'minecraft-protocol';
import { AccountInfo, Proxy } from './proxy';

export class Hub {
	private options: ServerOptions;
	private server: Server;
	public constructor(options: ServerOptions) {
		this.options = options;
		this.server = createServer(options);
	}

	public start(debug: boolean): Server {
		return this.server
			.on('error', console.error)
			.on('login', client => {
				const send = (text: string): void => client.write('chat', {
					message: JSON.stringify({
						'translate': 'chat.type.announcement',
						'with': [
							'Server',
							text,
						],
					}),
				});

				client.write('login', {
					levelType: 'default',
					gameMode: 3,
					dimension: 1,
				});
				client.write('position', {
					x: 0,
					y: 0,
					z: 0,
					yaw: 0,
					pitch: 0,
					flags: 0x00,
				});
				let accountInfo: AccountInfo | undefined;
				client
					.on('error', console.error)
					.on('packet', (data: any, meta: any) => {
						if (meta.name !== 'chat') return;
						const args = data.message.split(' ');
						switch (args[0]) {
							case '/login': {
								if (!args[1]) return send('Invalid username');

								accountInfo = { username: args[1], password: args[2] || undefined };
								send('Saved account, connect with /connect <address> (port)');
								break;
							}
							case '/connect': {
								if (!accountInfo) return send('No account saved, login with /login <username> <password>');
								if (!args[1]) return send('Invalid address');

								client.end('Done, Reconnect');
								this.server.close();

								const serverInfo = { host: args[1], port: args[2] || 25565 };
								const proxy = new Proxy(accountInfo, serverInfo, { port: 25566 })
									.start(debug)
									.on('login', client => {
										client.on('packet', (data: any, meta: any) => {
											if (meta.name !== 'chat') return;
											if (data.message === '.hub') {
												client.end('Done, Reconnect');
												proxy.close();

												new Hub(this.options).start(debug);
											}
										});
									});
								break;
							}
							default: {
								send('Unknown command');
								break;
							}
						}
					});

				send([
					'Commands: <> Required | () Optional',
					'/login <username> (password) - Login to a Minecraft account',
					'/connect <address> (port) - Login to a Minecraft server',
				].join('\n'));
			});
	}
}
