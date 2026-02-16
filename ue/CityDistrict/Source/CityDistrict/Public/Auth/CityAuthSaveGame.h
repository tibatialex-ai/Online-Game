#pragma once

#include "CoreMinimal.h"
#include "GameFramework/SaveGame.h"
#include "CityAuthSaveGame.generated.h"

UCLASS()
class CITYDISTRICT_API UCityAuthSaveGame : public USaveGame
{
    GENERATED_BODY()

public:
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Auth")
    FString AccessToken;
};
