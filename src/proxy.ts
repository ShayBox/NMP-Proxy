import { createClient, createServer, states, Server, ServerOptions } from 'minecraft-protocol';

export interface AccountInfo {
	username: string;
	password?: string;
}

export interface ServerInfo {
	host: string;
	port?: number;
}

export class Proxy {
	protected accountInfo: AccountInfo;
	protected serverInfo: ServerInfo;
	private server: Server;
	public constructor(accountInfo: AccountInfo, serverInfo: ServerInfo, options: ServerOptions) {
		this.accountInfo = accountInfo;
		this.serverInfo = serverInfo;
		this.server = createServer({ keepAlive: false, ...options });
	}

	public start(debug: boolean): Server {
		return this.server.on('login', client => {
			const address = client.socket.remoteAddress;
			if (debug) console.log('Incoming connection from', address);

			let endedClient = false;
			let endedProxyClient = false;
			const proxyClient = createClient({
				username: this.accountInfo.username,
				password: this.accountInfo.password,
				host: this.serverInfo.host,
				port: this.serverInfo.port,
				keepAlive: false,
			});

			client.on('end', () => {
				endedClient = true;
				if (debug) console.log('Connection closed by client from', address);
				if (!endedProxyClient) proxyClient.end('End');
			});
			client.on('error', error => {
				endedClient = true;
				if (debug) {
					console.log('Connection error by client from', address);
					console.log(error.stack);
				}
				if (!endedProxyClient) proxyClient.end('Error');
			});
			client.on('raw', (data, meta) => {
				if (proxyClient.state !== states.PLAY || meta.state !== states.PLAY) return;
				if (endedProxyClient) return;
				proxyClient.writeRaw(data);
			});

			proxyClient.on('end', () => {
				endedProxyClient = true;
				if (debug) console.log('Connection closed by server from', address);
				if (!endedClient) client.end('End');
			});
			proxyClient.on('error', error => {
				endedProxyClient = true;
				if (debug) {
					console.log('Connection error by server from', address);
					console.log(error.stack);
				}
				if (!endedClient) client.end('Error');
			});
			proxyClient.on('raw', (data, meta) => {
				if (meta.state !== states.PLAY || client.state !== states.PLAY) return;
				if (endedClient) return;
				client.writeRaw(data);
			});
		});
	}
}
