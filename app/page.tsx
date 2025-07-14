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
import { useEffect, useState } from "react";
import { Client, XOConnectProvider } from "xo-connect";


const useXOConnect = true;

interface Token {
  id: string;
  symbol: string;
  address: string;
  decimals: number;
  chainId: number;
  image?: string;
}

export default function Demo() {
  const [loading, setLoading] = useState(true);
  const [address, setAddress] = useState("");
  const [alias, setAlias] = useState("");
  const [avatar, setAvatar] = useState("");
  const [signature, setSignature] = useState("");
  const [tokens, setTokens] = useState<Token[]>([]);
  const [selectedTokenId, setSelectedTokenId] = useState<string>();
  const [signer, setSigner] = useState<ethers.Signer>();

  const selectedToken = tokens.find((t) => t.id === selectedTokenId);

  useEffect(() => {
    const init = async () => {
      try {
        const rawProvider = useXOConnect
          ? new XOConnectProvider()
          : (window as any).ethereum;

        const web3Provider = new ethers.providers.Web3Provider(
          rawProvider,
          "any"
        );
        await web3Provider.send("eth_requestAccounts", []);
        const signer = web3Provider.getSigner();
        const addr = await signer.getAddress();

        setSigner(signer);
        setAddress(addr);

        if (useXOConnect) {
          const xo = rawProvider as XOConnectProvider;
          const client: Client = await xo.getClient();
          setAlias(client.alias || "");
          setAvatar(client.image || "");

          const currencies = await xo.getAvailableCurrencies();
          const mapped = currencies.map((c) => ({
            id: c.id,
            symbol: c.symbol,
            address: c.address,
            decimals: c.decimals,
            chainId: parseInt(c.chainId),
            image: c.image,
          }));
          setTokens(mapped);
          setSelectedTokenId(mapped[0]?.id);
        } else {
          const currencies = [
            {
              id: "polygon.mainnet.native.matic",
              symbol: "POL",
              image:
                "https://beexo.nyc3.digitaloceanspaces.com/staging/digital-currencies/1708714736817-thumbnail",
              address: "0x5c98709a53151c1861A81e33a33C35B13e5f3670",
              chainId: 137,
              decimals: 18,
            }
          ];
          setTokens(currencies);
          setSelectedTokenId(currencies[0]?.id);
        }

        setLoading(false);
      } catch (err) {
        console.error("Error al conectar:", err);
      }
    };
    init();
  }, []);

  const handlePersonalSign = async () => {
    if (!signer) return;
    try {
      const msg = "Hola desde XOConnect";
      const sig = await signer.signMessage(msg);
      const who = ethers.utils.verifyMessage(msg, sig);
      setSignature(sig);
      console.log(sig);
      alert(`Signature: ${sig}\nFirmado por: ${who}`);
    } catch (e) {
      console.log("Personal sign error:", e);
    }
  };

  const handleSendNativeTransaction = async () => {
    if (!signer || !selectedToken) return;
    try {
      const tx = {
        to: "0x3ca4dBE59Cb3ff037DF60Eb615B29e6F1C498004",
        value: ethers.utils.parseUnits("0.001", selectedToken.decimals),
        chainId: selectedToken.chainId,
      };
      const sentTx = await signer.sendTransaction(tx);
      await sentTx.wait();
      alert(`Enviado 0.001 ${selectedToken.symbol}. Hash: ${sentTx.hash}`);
    } catch (e) {
      console.error("🟥 Transfer error:", e);
      const keys = Object.getOwnPropertyNames(e);
      for (const key of keys) {
        console.log(`🟡 ${key}:`, (e as any)[key]);
      }
    }
  };

  const handleSendUsdtOnPolygon = async () => {
    if (!signer || !selectedToken) return;
    const TO = "0x3ca4dBE59Cb3ff037DF60Eb615B29e6F1C498004";
    const USDT = "0xc2132D05D31c914a87C6611C10748AEb04B58e8F";
    const CHAIN_ID = 137;

    try {
      const abi = ["function transfer(address to, uint amount)"];
      const iface = new ethers.utils.Interface(abi);
      const amount = ethers.utils.parseUnits("0.001", 6); // USDT tiene 6 decimales
      const data = iface.encodeFunctionData("transfer", [TO, amount]);

      const tx = {
        to: USDT,
        data,
        value: "0x0",
        chainId: selectedToken.chainId,
      };
      console.log("Here");
      const sentTx = await signer.sendTransaction(tx);
      await sentTx.wait();
      alert(`Enviado 0.001 USDT (Polygon). Hash: ${sentTx.hash}`);
    } catch (e) {
      console.log("🟥 USDT transfer error:", e);
      const keys = Object.getOwnPropertyNames(e);
      for (const key of keys) {
        console.log(`🟡 ${key}:`, (e as any)[key]);
      }
    }
  };

  const handleTypedDataSign = async () => {
    if (!signer || !selectedToken) return;

    const domain = {
      name: "DemoApp",
      version: "1",
      verifyingContract: "0x0000000000000000000000000000000000000000",
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
      setSignature(sig);
      console.log(sig);
      alert("Typed Data Signature: " + sig);
    } catch (e) {
      console.log("🟥 Typed data sign error:", e);
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

            {selectedToken && (
              <Button className="w-full" onClick={handleSendNativeTransaction}>
                Enviar 0.001 {selectedToken.symbol}
              </Button>
            )}

            {selectedToken?.symbol === "POL" && (
              <Button className="w-full" onClick={handleSendUsdtOnPolygon}>
                Enviar 0.001 USDT
              </Button>
            )}
            {selectedToken && (
              <Button className="w-full" onClick={handleTypedDataSign}>
                Firmar Typed Data
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}


//d1b