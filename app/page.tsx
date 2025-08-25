"use client";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { ethers } from "ethers";
import { useEffect, useMemo, useState } from "react";
import { Client, XOConnectProvider } from "xo-connect";

const useXOConnect = true;

// ---------- Types ----------
interface Token {
  id: string;
  symbol: string;
  address: string; // ERC-20 address (or native wrapper if applicable)
  decimals: number;
  chainId: number; // decimal (e.g., 1, 137)
  image?: string;
}

// ---------- ABIs ----------
const erc20Abi = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
];

const uniV2PairAbi = [
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
];

// ---------- Known ERC-20 / pairs by chain ----------
const KNOWN: Record<
  number,
  { label: string; erc20: string; uniPair?: string }
> = {
  1: {
    label: "USDC",
    erc20: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    // Uniswap V2 USDC/WETH
    uniPair: "0xB4e16d0168e52d35CaCD2c6185b44281Ec28C9Dc",
  },
  137: {
    label: "USDT",
    erc20: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
  },
};

// ---------- Helpers ----------
const decToHexChain = (dec: number) => `0x${dec.toString(16)}`;
const hexToDecChain = (hex: string) => parseInt(hex, 16);

export default function Demo() {
  const [loading, setLoading] = useState(true);
  const [address, setAddress] = useState("");
  const [alias, setAlias] = useState("");
  const [avatar, setAvatar] = useState("");
  const [tokens, setTokens] = useState<Token[]>([]);
  const [selectedTokenId, setSelectedTokenId] = useState<string>();
  const [signer, setSigner] = useState<ethers.Signer>();
  const [provider, setProvider] = useState<ethers.providers.Web3Provider>();
  const [rawProvider, setRawProvider] = useState<any>();

  // read-only state
  const [readInfo, setReadInfo] = useState<{
    name?: string;
    symbol?: string;
    decimals?: number;
    totalSupply?: string;
    userBalance?: string;
  }>({});

  const [uniReserves, setUniReserves] = useState<{
    token0?: string;
    token1?: string;
    reserve0?: string;
    reserve1?: string;
  }>({});

  const selectedToken = useMemo(
    () => tokens.find((t) => t.id === selectedTokenId),
    [tokens, selectedTokenId]
  );

  // Ensure the provider is on a given hex chain (switch if needed)
  const ensureChain = async (targetHexChainId: string) => {
    if (!rawProvider) return;

    // Ask current chain
    const currentHex =
      (await rawProvider.request?.({ method: "eth_chainId" })) ??
      (await provider?.send("eth_chainId", []));

    if ((currentHex || "").toLowerCase() !== targetHexChainId.toLowerCase()) {
      await rawProvider.request?.({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: targetHexChainId }],
      });
    } 
  };


  useEffect(() => {
    const init = async () => {
      try {
        const defaultHex = "0x1"; 
        const rpcs = {
          "0x1": process.env.NEXT_PUBLIC_ETH,
          "0x89": process.env.NEXT_PUBLIC_POL,
        };

        const raw = useXOConnect
          ? new XOConnectProvider({
              rpcs,
              defaultChainId: defaultHex,
            })
          : (window as any).ethereum;

        const web3 = new ethers.providers.Web3Provider(raw, "any");
        await web3.send("eth_requestAccounts", []);
        const s = web3.getSigner();
        const addr = await s.getAddress();

        setRawProvider(raw);
        setProvider(web3);
        setSigner(s);
        setAddress(addr);

        // Load client + currencies
        if (useXOConnect) {
          const xo = raw as XOConnectProvider;
          const client: Client = await xo.getClient();
          setAlias(client.alias || "");
          setAvatar(client.image || "");

          const currencies = await xo.getAvailableCurrencies();
          const mapped: Token[] = (currencies || []).map((c: any) => ({
            id: c.id,
            symbol: c.symbol,
            address: c.address,
            decimals: c.decimals,
            chainId: parseInt(c.chainId, 16) || parseInt(c.chainId), // support hex or dec
            image: c.image,
          }));

          setTokens(mapped);

          // Prefer a token on the default chain; else, pick the first and switch to its chain
          const prefer = mapped.find(
            (t) => decToHexChain(t.chainId).toLowerCase() === defaultHex
          );
          const initial = prefer ?? mapped[0];
          if (initial) {
            const initialHex = decToHexChain(initial.chainId);
            await ensureChain(initialHex);
            setSelectedTokenId(initial.id);
          }
        } else {
          const currencies: Token[] = [
            {
              id: "ethereum.mainnet.native.eth",
              symbol: "ETH",
              address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", // placeholder for native
              chainId: 1,
              decimals: 18,
            },
            {
              id: "polygon.mainnet.native.matic",
              symbol: "POL",
              image:
                "https://beexo.nyc3.digitaloceanspaces.com/staging/digital-currencies/1708714736817-thumbnail",
              address: "0x0000000000000000000000000000000000001010", // Polygon native (PoS WETH-like placeholder)
              chainId: 137,
              decimals: 18,
            },
          ];
          setTokens(currencies);

          // align with default
          const prefer = currencies.find(
            (t) => decToHexChain(t.chainId).toLowerCase() === defaultHex
          );
          const initial = prefer ?? currencies[0];
          if (initial) {
            await ensureChain(decToHexChain(initial.chainId));
            setSelectedTokenId(initial.id);
          }
        }

        setLoading(false);
      } catch (err) {
        console.error("Error al conectar:", err);
        setLoading(false);
      }
    };

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When the user picks a token, always switch to the token’s chain first.
  useEffect(() => {
    const switchIfNeeded = async () => {
      if (!selectedToken) return;
      const targetHex = decToHexChain(selectedToken.chainId);
      await ensureChain(targetHex);
    };
    switchIfNeeded();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTokenId]);

  const handlePersonalSign = async () => {
    if (!signer) return;
    try {
      const msg = "Hola desde XOConnect";
      const sig = await signer.signMessage(msg);
      const who = ethers.utils.verifyMessage(msg, sig);
      alert(`Signature: ${sig}\nFirmado por: ${who}`);
    } catch (e) {
      console.log("Personal sign error:", e);
    }
  };

  const handleSendNativeTransaction = async () => {
    if (!signer || !selectedToken) return;
    try {
      // Switch is already handled by effect; just send
      const tx = {
        to: "0x3ca4dBE59Cb3ff037DF60Eb615B29e6F1C498004",
        value: ethers.utils.parseUnits("0.001", 18), // native is 18
        // ethers v5 ignores chainId here when using a signer bound to a provider
      };
      const sentTx = await signer.sendTransaction(tx);
      await sentTx.wait();
      alert(`Enviado 0.001 ${selectedToken.symbol}. Hash: ${sentTx.hash}`);
    } catch (e) {
      console.error("🟥 Transfer error:", e);
    }
  };

  const handleSendUsdtOnPolygon = async () => {
    if (!signer) return;

    // Always target Polygon (137)
    const CHAIN_ID_DEC = 137;
    const CHAIN_ID_HEX = decToHexChain(CHAIN_ID_DEC);
    const TO = "0x3ca4dBE59Cb3ff037DF60Eb615B29e6F1C498004";
    const USDT = KNOWN[137].erc20;

    try {
      await ensureChain(CHAIN_ID_HEX);

      const abi = ["function transfer(address to, uint amount)"];
      const iface = new ethers.utils.Interface(abi);
      const amount = ethers.utils.parseUnits("0.001", 6); // USDT has 6 decimals
      const data = iface.encodeFunctionData("transfer", [TO, amount]);

      const tx = { to: USDT, data, value: "0x0" };
      const sentTx = await signer.sendTransaction(tx);
      await sentTx.wait();
      alert(`Enviado 0.001 USDT (Polygon). Hash: ${sentTx.hash}`);
    } catch (e) {
      console.log("🟥 USDT transfer error:", e);
    }
  };

  const handleTypedDataSign = async () => {
    if (!signer) return;

    const domain = {
      name: "DemoApp",
      version: "1",
      verifyingContract: "0x0000000000000000000000000000000000000000",
      // Optionally add chainId to domain if you want stricter EIP-712 validation
      // chainId: await signer.getChainId?.(),
    };

    const types = {
      Mail: [
        { name: "from", type: "string" },
        { name: "to", type: "string" },
        { name: "contents", type: "string" },
      ],
    };

    const value = {
      from: "XO",
      to: "Santi",
      contents: "Hola, esto es una firma EIP-712",
    };

    try {
      const sig = await (
        signer as ethers.providers.JsonRpcSigner
      )._signTypedData(domain, types, value);
      alert("Typed Data Signature: " + sig);
    } catch (e) {
      console.log("🟥 Typed data sign error:", e);
    }
  };

  const handleReadErc20 = async () => {
    try {
      if (!signer) return;
      const chainId =
        (await (signer as any).getChainId?.()) ?? selectedToken?.chainId;
      if (!chainId) throw new Error("No chainId available");

      const known = KNOWN[chainId];
      if (!known) {
        alert(`No hay contrato conocido para chainId ${chainId}`);
        return;
      }

      const erc20 = new ethers.Contract(
        known.erc20,
        erc20Abi,
        signer.provider as any
      );

      const [name, symbol, decimals, totalSupplyRaw, user] = await Promise.all([
        erc20.name(),
        erc20.symbol(),
        erc20.decimals(),
        erc20.totalSupply(),
        signer.getAddress(),
      ]);

      const userBalRaw = await erc20.balanceOf(user);

      setReadInfo({
        name,
        symbol,
        decimals,
        totalSupply: ethers.utils.formatUnits(totalSupplyRaw, decimals),
        userBalance: ethers.utils.formatUnits(userBalRaw, decimals),
      });

      alert(
        `${known.label} (${symbol})\n` +
          `name: ${name}\n` +
          `decimals: ${decimals}\n` +
          `totalSupply: ${ethers.utils.formatUnits(
            totalSupplyRaw,
            decimals
          )}\n` +
          `yourBalance: ${ethers.utils.formatUnits(userBalRaw, decimals)}`
      );
    } catch (e) {
      console.log("🟥 ERC20 read error:", e);
    }
  };

  const handleReadUniV2Reserves = async () => {
    try {
      if (!signer) return;

      // Force Ethereum for this example
      await ensureChain("0x1");

      const pair = new ethers.Contract(
        KNOWN[1].uniPair!,
        uniV2PairAbi,
        signer.provider as any
      );
      const [t0, t1, reserves] = await Promise.all([
        pair.token0(),
        pair.token1(),
        pair.getReserves(),
      ]);

      setUniReserves({
        token0: t0,
        token1: t1,
        reserve0: reserves.reserve0.toString(),
        reserve1: reserves.reserve1.toString(),
      });

      alert(
        `Uniswap V2 USDC/WETH\n` +
          `token0: ${t0}\n` +
          `token1: ${t1}\n` +
          `reserve0: ${reserves.reserve0.toString()}\n` +
          `reserve1: ${reserves.reserve1.toString()}`
      );
    } catch (e) {
      console.log("🟥 UniV2 read error:", e);
    }
  };

  return (
    <div className="max-w-xl mx-auto py-10 space-y-6 px-4">
      {loading ? (
        <div className="text-center text-muted">Connecting...</div>
      ) : (
        <>
          <div className="flex items-center gap-4">
            {avatar && (
              <img
                src={avatar}
                alt="Avatar"
                className="w-10 h-10 rounded-full border"
              />
            )}
            <div>
              <p className="font-medium text-lg">{alias || "Sin alias"}</p>
              <p className="text-sm text-muted-foreground break-all">
                {address}
              </p>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Moneda:</label>
            <Select value={selectedTokenId} onValueChange={setSelectedTokenId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccionar token" />
              </SelectTrigger>
              <SelectContent>
                {tokens.map((token) => (
                  <SelectItem key={token.id} value={token.id}>
                    <div className="flex items-center gap-2">
                      {token.image && (
                        <img
                          src={token.image}
                          alt={token.symbol}
                          className="w-4 h-4 rounded-full"
                        />
                      )}
                      {token.symbol} (chainId {token.chainId})
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Button className="w-full" onClick={handlePersonalSign}>
              Firmar mensaje
            </Button>

            <Button className="w-full" onClick={handleSendNativeTransaction}>
              Enviar 0.001 {selectedToken?.symbol ?? "NATIVE"}
            </Button>

            <Button className="w-full" onClick={handleSendUsdtOnPolygon}>
              Enviar 0.001 USDT (Polygon)
            </Button>

            <Button className="w-full" onClick={handleTypedDataSign}>
              Firmar Typed Data
            </Button>

            <Button
              variant="secondary"
              className="w-full"
              onClick={handleReadErc20}
            >
              Leer{" "}
              {(selectedToken && KNOWN[selectedToken.chainId]?.label) ||
                "ERC-20"}{" "}
              (read-only)
            </Button>

            <Button
              variant="secondary"
              className="w-full"
              onClick={handleReadUniV2Reserves}
            >
              Leer Uniswap V2 (USDC/WETH) Reserves (Ethereum)
            </Button>
          </div>

          {!!readInfo.symbol && (
            <div className="text-sm text-muted-foreground">
              <div>
                Token: {readInfo.name} ({readInfo.symbol})
              </div>
              <div>Decimals: {readInfo.decimals}</div>
              <div>Total Supply: {readInfo.totalSupply}</div>
              <div>Your Balance: {readInfo.userBalance}</div>
            </div>
          )}

          {!!uniReserves.token0 && (
            <div className="text-sm text-muted-foreground">
              <div>Uniswap V2 Pair</div>
              <div>token0: {uniReserves.token0}</div>
              <div>token1: {uniReserves.token1}</div>
              <div>reserve0: {uniReserves.reserve0}</div>
              <div>reserve1: {uniReserves.reserve1}</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
