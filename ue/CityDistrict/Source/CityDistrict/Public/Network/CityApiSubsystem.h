#pragma once

#include "CoreMinimal.h"
#include "Subsystems/GameInstanceSubsystem.h"
#include "CityApiSubsystem.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FCityApiSimpleResponse, bool, bSuccess, const FString&, ErrorMessage);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_FiveParams(
    FCityProfileLoaded,
    bool,
    bSuccess,
    const FString&,
    Nickname,
    float,
    Balance,
    const FString&,
    Subscription,
    const FString&,
    ErrorMessage
);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_ThreeParams(FCityRatingsLoaded, float, GameRating, float, MlmRating, const FString&, ErrorMessage);

UCLASS(Config=Game)
class CITYDISTRICT_API UCityApiSubsystem : public UGameInstanceSubsystem
{
    GENERATED_BODY()

public:
    virtual void Initialize(FSubsystemCollectionBase& Collection) override;

    UFUNCTION(BlueprintCallable, Category = "City API|Auth")
    void RegisterUser(const FString& Nickname, const FString& Password, const FString& RefCode);

    UFUNCTION(BlueprintCallable, Category = "City API|Auth")
    void LoginUser(const FString& Nickname, const FString& Password);

    UFUNCTION(BlueprintCallable, Category = "City API|User")
    void LoadCurrentUserProfile();

    UFUNCTION(BlueprintCallable, Category = "City API|Auth")
    void Logout();

    UFUNCTION(BlueprintPure, Category = "City API|Auth")
    bool HasAccessToken() const;

    UFUNCTION(BlueprintPure, Category = "City API|Auth")
    FString GetAccessToken() const;

    UPROPERTY(BlueprintAssignable, Category = "City API|Auth")
    FCityApiSimpleResponse OnRegisterFinished;

    UPROPERTY(BlueprintAssignable, Category = "City API|Auth")
    FCityApiSimpleResponse OnLoginFinished;

    UPROPERTY(BlueprintAssignable, Category = "City API|User")
    FCityProfileLoaded OnProfileLoaded;

    UPROPERTY(BlueprintAssignable, Category = "City API|User")
    FCityRatingsLoaded OnRatingsLoaded;

protected:
    UPROPERTY(Config, EditAnywhere, Category = "City API")
    FString ApiBaseUrl = TEXT("http://127.0.0.1:3000");

private:
    FString AccessToken;
    FString CachedNickname;
    FString CachedSubscription;
    float CachedGameRating = 0.0f;
    float CachedMlmRating = 0.0f;

    static constexpr TCHAR SaveSlotName[] = TEXT("CityAuthSlot");

    void SaveToken();
    void LoadToken();

    FString BuildUrl(const FString& Path) const;
    void SendJsonRequest(const FString& Method, const FString& Path, const FString& Body, bool bAuthorized, TFunction<void(bool, const FString&, const FString&)> OnCompleted);
    static bool ExtractErrorMessage(const FString& JsonString, FString& OutError);
};
