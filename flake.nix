{
  description = "Dev shell and Linting";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";

    precommit = {
      url = "github:FredSystems/pre-commit-checks";
      inputs.nixpkgs.follows = "nixpkgs";
    };

    npm-chck.url = "github:fredsystems/npm-chck";
  };

  outputs =
    {
      self,
      nixpkgs,
      precommit,
      npm-chck,
      ...
    }:
    let
      systems = precommit.lib.supportedSystems;
      inherit (nixpkgs) lib;
    in
    {
      ##########################################################################
      ## PRE-COMMIT CHECKS
      ##########################################################################
      checks = lib.genAttrs systems (system: {
        pre-commit = precommit.lib.mkCheck {
          inherit system;
          src = ./.;

          # ── Feature toggles ─────────────────────────────
          check_rust = false;
          check_docker = true;
          check_python = false;
          check_javascript = true;

          # Rust-specific knobs (safe to leave here)
          enableXtask = false;

          # Python-specific knobs (safe to leave here)
          python = {
            enableBlack = true;
            enableFlake8 = true;
          };

          javascript = {
            enableBiome = true;
            enableTsc = true;
            tsConfig = "tsconfig.json";
          };
        };
      });

      ##########################################################################
      ## DEV SHELL
      ##########################################################################
      devShells = lib.genAttrs systems (
        system:
        let
          pkgs = import nixpkgs { inherit system; };
          chk = self.checks.${system}.pre-commit;
        in
        {
          default = pkgs.mkShell {
            buildInputs =
              chk.enabledPackages
              ++ (chk.passthru.devPackages or [ ])
              ++ (with pkgs; [
                pre-commit
                check-jsonschema
                codespell
                typos
                nixfmt
                markdownlint-cli2
                nodejs
                pnpm
                vercel-pkg
                prisma
                npm-chck.packages.${system}.default
                sqlite
                openssl
              ]);

            LD_LIBRARY_PATH = pkgs.lib.makeLibraryPath (chk.passthru.libPath or [ ]);

            shellHook = with pkgs; ''
              ${chk.shellHook}
              alias pre-commit="pre-commit run --all-files"
              export PRISMA_SCHEMA_ENGINE_BINARY="${prisma-engines}/bin/schema-engine"
              export PRISMA_QUERY_ENGINE_BINARY="${prisma-engines}/bin/query-engine"
              export PRISMA_QUERY_ENGINE_LIBRARY="${prisma-engines}/lib/libquery_engine.node"
              export PRISMA_FMT_BINARY="${prisma-engines}/bin/prisma-fmt"
            '';
          };
        }
      );
    };
}
