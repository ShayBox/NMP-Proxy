import { Client, ClientOptions, createClient, createServer, Server, ServerOptions, states } from 'minecraft-protocol';

const login = (client: Client, clientOptions: ClientOptions): void => {
	const address = client.socket.remoteAddress;
	console.log('Incoming connection from', address);

	let endedClient = false;
	let endedProxyClient = false;
	const proxyClient = createClient(clientOptions);

	client.on('end', () => {
		endedClient = true;
		console.log('Connection closed by client from', address);
		if (!endedProxyClient) proxyClient.end('End');
	});
	client.on('error', error => {
		endedClient = true;
		console.log('Connection error by client from', address);
		console.log(error.stack);
		if (!endedProxyClient) proxyClient.end('Error');
	});
	client.on('raw', (data, meta) => {
		if (proxyClient.state !== states.PLAY || meta.state !== states.PLAY) return;
		if (endedProxyClient) return;
		proxyClient.writeRaw(data);
	});

	proxyClient.on('end', () => {
		endedProxyClient = true;
		console.log('Connection closed by server from', address);
		if (!endedClient) client.end('End');
	});
	proxyClient.on('error', error => {
		endedProxyClient = true;
		console.log('Connection error by server from', address);
		console.log(error.stack);
		if (!endedClient) client.end('Error');
	});
	proxyClient.on('raw', (data, meta) => {
		if (meta.state !== states.PLAY || client.state !== states.PLAY) return;
		if (endedClient) return;
		client.writeRaw(data);
	});
};

export function startProxy(serverOptions: ServerOptions, clientOptions: ClientOptions): Server {
	const server: Server = createServer(serverOptions)
		.on('error', console.error)
		.on('login', client => login(client, clientOptions));

	return server;
}
