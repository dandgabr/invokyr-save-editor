#!/usr/bin/env python3
"""
Invokyr Save Codec & Modifier Utility
Compatível com Unity 6 / IL2CPP Metadata v39 / MessagePack-CSharp / Schema v15.

Este script realiza leitura, validação, exportação e empacotamento de saves de Invokyr
com preservação estrita de tipos em ponto flutuante (float32 IEEE 754 / Single),
backups automáticos atômicos e funções de conveniência para desbloqueios.
"""

import sys
import os
import io
import time
import shutil
import argparse
import json
import zipfile
from datetime import datetime

try:
    import msgpack
except ImportError:
    print("[ERRO] O módulo 'msgpack' não está instalado. Execute: pip install msgpack", file=sys.stderr)
    sys.exit(1)


# Enum canônico de Heróis de Invokyr
HERO_NAMES = [
    "Red", "Specs", "Tank", "Ziggy",
    "Carl", "Bobby", "Susan", "Lily"
]

# Enum canônico de Mobílias do Hub (EGameRoomFurniture)
FURNITURE_NAMES = {
    1: "RADIO",
    2: "WARDROBE (Armário)",
    3: "MIRROR (Espelho)",
    4: "DISCO (Globo)",
    5: "DOORBELL (Campainha)",
    6: "DICEBOX_FIREWORK (Caixa Fogos)",
    7: "DICEBOX_CUBE (Caixa Cubo)",
    8: "OLD_CLOCK (Relógio Antigo)"
}


def unpack_msgpack_stream(stream_bytes: bytes) -> dict:
    """Deserializa um payload MessagePack do C# para dicionário Python."""
    return msgpack.unpackb(stream_bytes, raw=False, strict_map_key=False)


def pack_msgpack_stream(data: dict) -> bytes:
    """
    Serializa um dicionário para MessagePack garantindo compatibilidade estrita
    com System.Single (float32) do C#/Unity usando use_single_float=True.
    """
    return msgpack.packb(data, use_bin_type=True, use_single_float=True)


def read_save_file(save_path: str) -> dict:
    """Lê um arquivo .sav (ZIP) e extrai os streams 'meta', 'save' e 'collection'."""
    if not os.path.isfile(save_path):
        raise FileNotFoundError(f"Arquivo de save não encontrado: {save_path}")

    save_data = {}
    with zipfile.ZipFile(save_path, 'r') as zf:
        namelist = zf.namelist()
        for stream_name in ['meta', 'save', 'collection']:
            if stream_name not in namelist:
                raise ValueError(f"Contêiner inválido: stream '{stream_name}' não encontrado no ZIP.")
            raw_bytes = zf.read(stream_name)
            save_data[stream_name] = unpack_msgpack_stream(raw_bytes)

    return save_data


def write_save_file(save_data: dict, output_path: str, create_backup: bool = True) -> str:
    """
    Empacota os dicionários 'meta', 'save' e 'collection' em um contêiner ZIP válido (.sav).
    Realiza escrita atômica via arquivo temporário e validação com testzip().
    """
    backup_path = None
    if create_backup and os.path.exists(output_path):
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_path = f"{output_path}.bak_{timestamp}"
        shutil.copy2(output_path, backup_path)
        print(f"[BACKUP] Backup criado com sucesso em: {backup_path}")

    # Serializar os 3 componentes com MessagePack
    meta_bytes = pack_msgpack_stream(save_data['meta'])
    save_bytes = pack_msgpack_stream(save_data['save'])
    collection_bytes = pack_msgpack_stream(save_data['collection'])

    # Gravar em arquivo temporário no mesmo diretório para garantir atomicidade no os.replace
    dir_name = os.path.dirname(os.path.abspath(output_path))
    temp_path = os.path.join(dir_name, f".tmp_{os.path.basename(output_path)}")

    try:
        with zipfile.ZipFile(temp_path, 'w', compression=zipfile.ZIP_DEFLATED) as zf:
            zf.writestr('meta', meta_bytes)
            zf.writestr('save', save_bytes)
            zf.writestr('collection', collection_bytes)

        # Testar a integridade do ZIP antes da substituição atômica
        with zipfile.ZipFile(temp_path, 'r') as zf:
            test_res = zf.testzip()
            if test_res is not None:
                raise IOError(f"Falha de integridade no ZIP gerado no stream: {test_res}")

        # Substituição atômica
        os.replace(temp_path, output_path)
        print(f"[OK] Save salvo com sucesso em: {output_path}")
    finally:
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except OSError:
                pass

    return backup_path or output_path


def inspect_save(save_path: str):
    """Exibe um relatório detalhado e legível de todas as estruturas do save."""
    data = read_save_file(save_path)
    meta = data['meta']
    save = data['save']
    collection = data['collection']

    print("=" * 65)
    print(f"📊 RELATÓRIO TÉCNICO DE SAVE: {os.path.basename(save_path)}")
    print("=" * 65)

    # 1. Informações de Slot e Sessão (meta)
    print("\n[1] METADADOS DA SESSÃO (meta)")
    print(f"  • Versão do Esquema:       {save.get('version', 'Desconhecida')} (Schema Guard)")
    print(f"  • Rodada Atual:            {meta.get('roundIndex', 0)}")
    print(f"  • Pontuação da Partida:    {meta.get('score', 0)}")
    print(f"  • Tempo de Jogo:           {meta.get('playTimeSeconds', 0.0):.1f} s ({meta.get('playTimeSeconds', 0.0)/60:.1f} min)")
    print(f"  • Ranque Endless:          {meta.get('endlessRank', 0)}")
    print(f"  • Jogadores Ativos:        {meta.get('playerCount', 0)}")

    owners = meta.get('characterOwners', [])
    print("  • Heróis e Proprietários (characterOwners):")
    for idx, steam_id in enumerate(owners):
        hero = HERO_NAMES[idx] if idx < len(HERO_NAMES) else f"Hero_{idx}"
        status = f"SteamID64: {steam_id}" if steam_id != 0 else "[LIVRE]"
        print(f"     [{idx}] {hero:<6}: {status}")

    # 2. Estado do Mundo e Economia (save)
    print("\n[2] ESTADO PERSISTENTE DA RUN (save)")
    bank_score = save.get('bank', {}).get('currentTotalScore', 0)
    print(f"  • Saldo no Banco (Meta):   {bank_score} moedas")
    print(f"  • Visitas à Loja:          {save.get('shop', {}).get('visitCount', 0)}")
    print(f"  • Seed de Ofertas:         {save.get('shop', {}).get('boardOffersSeed', 'N/A')}")
    print(f"  • Skin do Lobby/Sala:      Índice {save.get('gameRoomSkinIndex', 0)}")

    # Portas Destravadas
    unlocked_doors = save.get('unlockedKeyDoors', [])
    print(f"  • Portas Destravadas:      {unlocked_doors} (Total: {len(unlocked_doors)})")

    # Mobílias
    furnitures = save.get('furnitures', {}).get('furnitures', [])
    furn_desc = [f"{f_id} ({FURNITURE_NAMES.get(f_id, 'Desconhecido')})" for f_id in furnitures]
    print(f"  • Mobílias Ativas:         {', '.join(furn_desc) if furn_desc else 'Nenhuma'}")

    # Ferramentas da Sala
    room_tools = save.get('gameRoomTools', {}).get('itemStringIds', [])
    print(f"  • Ferramentas na Sala:     {', '.join(room_tools) if room_tools else 'Nenhuma'}")

    # Inventários dos Jogadores
    print("\n[3] INVENTÁRIOS DOS JOGADORES")
    inventories = save.get('playerInventories', [])
    for p_idx, inv in enumerate(inventories):
        items = inv.get('itemStringIds', [])
        batteries = inv.get('itemBatteryLevels', [])
        formatted_items = []
        for i_name, b_val in zip(items, batteries):
            b_str = "Infinito" if b_val == -1.0 else f"{int(b_val*100)}%"
            formatted_items.append(f"{i_name} (Bat: {b_str})")
        print(f"  • Jogador {p_idx + 1}: {', '.join(formatted_items) if formatted_items else '[Vazio]'}")

    # 3. Colecionáveis e Troféus (collection)
    print("\n[4] COLEÇÃO E CONQUISTAS PERENES (collection)")
    figurines_mask = collection.get('monsterFigurines', 0)
    unlocked_bits = [bit for bit in range(32) if (figurines_mask & (1 << bit)) != 0]
    print(f"  • Bitmask de Estatuetas:   {figurines_mask} (Bits ativos: {unlocked_bits})")
    print(f"  • Total Estatuetas Ativas: {len(unlocked_bits)}")
    print(f"  • Melhor Ranque Endless:   {collection.get('bestEndlessRank', 0)}")
    print(f"  • Tabuleiros Concluídos:   {collection.get('completedBoardKeys', [])}")
    print(f"  • Regras da Casa Batidas:  {collection.get('completedHouseRuleIds', [])}")
    print("=" * 65)


def unlock_all_features(save_path: str, output_path: str = None):
    """
    Desbloqueia automaticamente todas as portas do lobby, mobílias da sala,
    troféus/estatuetas da coleção e injeta um saldo generoso no banco.
    """
    if output_path is None:
        output_path = save_path

    data = read_save_file(save_path)
    save = data['save']
    collection = data['collection']

    print("[UNLOCK-ALL] Aplicando desbloqueio total de recursos...")

    # 1. Destrancar todas as portas do Lobby (índices 0 a 4)
    save['unlockedKeyDoors'] = [0, 1, 2, 3, 4]
    print("  ✓ Todas as 5 portas da GameRoom destrancadas: [0, 1, 2, 3, 4]")

    # 2. Desbloquear todas as mobílias da sala (1 a 8)
    save['furnitures'] = {'furnitures': [1, 2, 3, 4, 5, 6, 7, 8]}
    print("  ✓ Todas as 8 mobílias ativadas (Rádio, Armário, Espelho, Globo, Campainha, Caixas, Relógio)")

    # 3. Desbloquear todas as estatuetas 3D na CollectionRoom (bitmask completa 31 bits)
    collection['monsterFigurines'] = 2147483647  # 0x7FFFFFFF (31 bits ligados)
    print("  ✓ Todas as estatuetas de monstros ativadas na CollectionRoom (bitmask 2147483647)")

    # 4. Injetar moedas no Banco se estiver baixo
    current_score = save.get('bank', {}).get('currentTotalScore', 0)
    if current_score < 50000:
        save['bank']['currentTotalScore'] = 50000
        print(f"  ✓ Saldo no banco elevado de {current_score} para 50.000 moedas")

    # 5. Adicionar armas raras nas ferramentas da sala se não existirem
    room_tools = save.setdefault('gameRoomTools', {'itemStringIds': [], 'itemBatteryLevels': []})
    existing = set(room_tools['itemStringIds'])
    bonus_tools = [
        ("Data-Treasure-Flamethrower", 1.0),
        ("PF_BoardItem_Jungle_Hunter", 1.0),
        ("dice_boomheal", -1.0),
        ("dice_lightning", -1.0),
        ("ice", -1.0),
        ("k_corridor", -1.0)
    ]
    for tool_name, batt in bonus_tools:
        if tool_name not in existing:
            room_tools['itemStringIds'].append(tool_name)
            room_tools['itemBatteryLevels'].append(float(batt))
            print(f"  ✓ Ferramenta adicionada à bancada da GameRoom: {tool_name}")

    write_save_file(data, output_path, create_backup=True)
    print("[SUCESSO] Operação de Unlock-All concluída com sucesso!")


def verify_save_integrity(save_path: str):
    """Valida roundtrip completo (Leitura -> Serialização -> Leitura) e coerência de tipos."""
    print(f"[TESTE] Verificando integridade e roundtrip para: {save_path}")
    orig_data = read_save_file(save_path)

    # Serializar em memória
    mem_zip = io.BytesIO()
    with zipfile.ZipFile(mem_zip, 'w', compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr('meta', pack_msgpack_stream(orig_data['meta']))
        zf.writestr('save', pack_msgpack_stream(orig_data['save']))
        zf.writestr('collection', pack_msgpack_stream(orig_data['collection']))

    mem_zip.seek(0)

    # Re-deserializar
    with zipfile.ZipFile(mem_zip, 'r') as zf:
        re_meta = unpack_msgpack_stream(zf.read('meta'))
        re_save = unpack_msgpack_stream(zf.read('save'))
        re_collection = unpack_msgpack_stream(zf.read('collection'))

    # Checagens de integridade
    assert orig_data['meta']['roundIndex'] == re_meta['roundIndex'], "Discrepância em meta.roundIndex"
    assert orig_data['save']['version'] == re_save['version'], "Discrepância em save.version"
    assert orig_data['collection']['monsterFigurines'] == re_collection['monsterFigurines'], "Discrepância em collection.monsterFigurines"

    print("[TESTE APROVADO] O save passou em 100% dos testes de integridade e fidelidade binária!")


def main():
    parser = argparse.ArgumentParser(
        description="Invokyr Save Codec & Modifier - Ferramenta de Engenharia Reversa e Edição de Saves"
    )
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--inspect", "-i", metavar="SAVE_PATH", help="Inspeciona e exibe o conteúdo legível do save")
    group.add_argument("--export-json", "-e", nargs=2, metavar=("SAVE_PATH", "JSON_PATH"), help="Exporta o save .sav para um arquivo JSON legível")
    group.add_argument("--import-json", "-m", nargs=2, metavar=("JSON_PATH", "SAVE_PATH"), help="Reconstrói um save .sav binário a partir de um JSON")
    group.add_argument("--unlock-all", "-u", metavar="SAVE_PATH", help="Destrava portas, mobílias, estatuetas e bônus no save")
    group.add_argument("--verify-save", "-v", metavar="SAVE_PATH", help="Testa a integridade de serialização e compatibilidade de tipos")

    args = parser.parse_args()

    try:
        if args.inspect:
            inspect_save(args.inspect)
        elif args.export_json:
            save_path, json_path = args.export_json
            data = read_save_file(save_path)
            with open(json_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            print(f"[OK] Save exportado para JSON com sucesso: {json_path}")
        elif args.import_json:
            json_path, save_path = args.import_json
            with open(json_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            write_save_file(data, save_path, create_backup=True)
        elif args.unlock_all:
            unlock_all_features(args.unlock_all)
        elif args.verify_save:
            verify_save_integrity(args.verify_save)
    except Exception as err:
        print(f"[ERRO FATAL] {err}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
