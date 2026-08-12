#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import argparse
import getpass
import os
import sys

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

import requests

BASE_URL = os.environ.get("CONEXAO_API_URL", "https://2026.conexaofarmacologia.com.br/api/trpc")
ADMIN_EMAIL = os.environ.get("CONEXAO_ADMIN_EMAIL")
ADMIN_PASSWORD = os.environ.get("CONEXAO_ADMIN_PASSWORD")


def login():
    email = ADMIN_EMAIL or input("E-mail de professor/admin: ").strip()
    password = ADMIN_PASSWORD or getpass.getpass("Senha: ")
    r = requests.post(BASE_URL + "/teacherAuth.superAdminLogin", json={"json": {"email": email, "password": password}})
    data = r.json()
    if "result" not in data:
        sys.exit("[erro] Login falhou (resposta inesperada): " + str(data))
    resultado = data["result"]["data"]["json"]
    if not resultado.get("success", True) or "sessionToken" not in resultado:
        sys.exit("[erro] Login recusado: " + str(resultado.get("message", "motivo não informado")))
    return resultado["sessionToken"]


def chamar_query(caminho, params):
    import json
    import urllib.parse
    query_input = urllib.parse.quote(json.dumps({"json": params}))
    r = requests.get(BASE_URL + "/" + caminho + "?input=" + query_input)
    data = r.json()
    if "result" not in data:
        erro_msg = data.get("error", {}).get("json", {}).get("message", str(data))
        sys.exit("[erro] " + str(erro_msg))
    return data["result"]["data"]["json"]


def chamar_mutation(caminho, params):
    r = requests.post(BASE_URL + "/" + caminho, json={"json": params})
    data = r.json()
    if "result" not in data:
        erro_msg = data.get("error", {}).get("json", {}).get("message", str(data))
        sys.exit("[erro] " + str(erro_msg))
    return data["result"]["data"]["json"]


def listar(token, class_id):
    grupos = chamar_query("casosClinicos.getComposicaoGrupos", {"sessionToken": token, "classId": class_id})
    print("\n" + "=" * 62)
    print("  Composicao atual dos grupos")
    print("=" * 62)
    for g in grupos:
        print("\n  [{}] {} ({}/{})".format(g["grupoId"], g["nome"], len(g["membros"]), g["capacidade"]))
        for m in g["membros"]:
            print("    - ({}) {}".format(m["memberId"], m["nome"]))


def mover(token, class_id, member_id, grupo_id):
    res = chamar_mutation("casosClinicos.moverAluno", {
        "sessionToken": token, "classId": class_id, "memberId": member_id, "novoGrupoId": grupo_id,
    })
    if res.get("message"):
        print("  " + res["message"])
    else:
        print("  OK - movido do grupo {} para o grupo {}".format(res.get("moveuDe"), res.get("moveuPara")))


def remover(token, class_id, member_id):
    res = chamar_mutation("casosClinicos.removerAlunoDoGrupo", {
        "sessionToken": token, "classId": class_id, "memberId": member_id,
    })
    if res.get("message"):
        print("  " + res["message"])
    else:
        print("  OK - removido do grupo '{}' (id {})".format(res.get("nomeDoGrupo"), res.get("removidoDoGrupo")))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--class-id", type=int, required=True)
    sub = ap.add_subparsers(dest="acao", required=True)

    sub.add_parser("listar")

    p_mover = sub.add_parser("mover")
    p_mover.add_argument("--member-id", type=int, required=True)
    p_mover.add_argument("--grupo-id", type=int, required=True)

    p_remover = sub.add_parser("remover")
    p_remover.add_argument("--member-id", type=int, required=True)

    args = ap.parse_args()

    print("Autenticando...")
    token = login()

    if args.acao == "listar":
        listar(token, args.class_id)
    elif args.acao == "mover":
        mover(token, args.class_id, args.member_id, args.grupo_id)
    elif args.acao == "remover":
        remover(token, args.class_id, args.member_id)


if __name__ == "__main__":
    main()