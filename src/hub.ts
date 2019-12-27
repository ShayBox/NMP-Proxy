import { Client, ClientOptions, createServer, Server, ServerOptions } from 'minecraft-protocol';
import { startProxy } from './proxy';

const login = (client: Client, server: Server, serverOptions: ServerOptions): void => {
	const send = (text: string): void => {
		client.write('chat', {
			message: JSON.stringify({
				'translate': 'chat.type.announcement',
				'with': [
					'Server',
					text,
				],
			}),
		});
	};

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

	let clientOptions: ClientOptions;
	client
		.on('error', console.error)
		.on('packet', (data: any, meta: any) => {
			if (meta.name !== 'chat') return;
			const args = data.message.split(' ');
			switch (args[0]) {
				case '/login': {
					if (!args[1]) return send('Invalid username');

					clientOptions.username = args[1];
					clientOptions.password = args[2] || undefined;
					send('Saved account, connect with /connect <address> (port)');
					break;
				}
				case '/connect': {
					if (!clientOptions.username) return send('No account saved, login with /login <username> <password>');
					if (!args[1]) return send('Invalid address');

					clientOptions.host = args[1];
					clientOptions.port = args[2] || 25565;

					client.end('Done, Reconnect');
					server.close();

					const proxy = startProxy({ port: 25566 }, clientOptions)
						.on('login', client => {
							client.on('packet', (data: any, meta: any) => {
								if (meta.name !== 'chat') return;
								if (data.message === '.hub') {
									client.end('Done, Reconnect');
									proxy.close();

									// eslint-disable-next-line @typescript-eslint/no-use-before-define
									startHub(serverOptions);
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
};

export function startHub(options: ServerOptions): Server {
	const server: Server = createServer(options)
		.on('error', console.error)
		.on('login', client => login(client, server, options));

	return server;
}
