#include "Network/CityApiSubsystem.h"

#include "Auth/CityAuthSaveGame.h"
#include "Engine/Engine.h"
#include "HttpModule.h"
#include "Interfaces/IHttpResponse.h"
#include "Dom/JsonObject.h"
#include "JsonObjectConverter.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"
#include "Kismet/GameplayStatics.h"

constexpr TCHAR UCityApiSubsystem::SaveSlotName[];

namespace CityApiJsonKeys
{
    const FString AccessToken = TEXT("accessToken");
    const FString Nickname = TEXT("nickname");
    const FString GameRating = TEXT("gameRating");
    const FString MlmRating = TEXT("mlmRating");
    const FString Subscription = TEXT("subscription");
    const FString Tier = TEXT("tier");
    const FString Error = TEXT("error");
    const FString Message = TEXT("message");
    const FString BalanceToken = TEXT("balanceToken");
}

void UCityApiSubsystem::Initialize(FSubsystemCollectionBase& Collection)
{
    Super::Initialize(Collection);
    LoadToken();
}

void UCityApiSubsystem::RegisterUser(const FString& Nickname, const FString& Password, const FString& RefCode)
{
    const FString Body = RefCode.IsEmpty()
        ? FString::Printf(TEXT("{\"nickname\":\"%s\",\"password\":\"%s\"}"), *Nickname, *Password)
        : FString::Printf(TEXT("{\"nickname\":\"%s\",\"password\":\"%s\",\"refCodeOptional\":\"%s\"}"), *Nickname, *Password, *RefCode);

    SendJsonRequest(TEXT("POST"), TEXT("/auth/register"), Body, false, [this](bool bOk, const FString&, const FString& ErrorMessage)
    {
        OnRegisterFinished.Broadcast(bOk, ErrorMessage);
    });
}

void UCityApiSubsystem::LoginUser(const FString& Nickname, const FString& Password)
{
    const FString Body = FString::Printf(TEXT("{\"nickname\":\"%s\",\"password\":\"%s\"}"), *Nickname, *Password);

    SendJsonRequest(TEXT("POST"), TEXT("/auth/login"), Body, false, [this](bool bOk, const FString& Response, const FString& ErrorMessage)
    {
        if (!bOk)
        {
            OnLoginFinished.Broadcast(false, ErrorMessage);
            return;
        }

        TSharedPtr<FJsonObject> Json;
        TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(Response);
        if (!FJsonSerializer::Deserialize(Reader, Json) || !Json.IsValid() || !Json->HasTypedField<EJson::String>(CityApiJsonKeys::AccessToken))
        {
            OnLoginFinished.Broadcast(false, TEXT("Login succeeded but accessToken is missing in response."));
            return;
        }

        AccessToken = Json->GetStringField(CityApiJsonKeys::AccessToken);
        SaveToken();
        OnLoginFinished.Broadcast(true, FString());
    });
}

void UCityApiSubsystem::LoadCurrentUserProfile()
{
    if (!HasAccessToken())
    {
        OnProfileLoaded.Broadcast(false, FString(), 0.0f, FString(), TEXT("JWT token is not set. Please login first."));
        OnRatingsLoaded.Broadcast(0.0f, 0.0f, TEXT("JWT token is not set. Please login first."));
        return;
    }

    SendJsonRequest(TEXT("GET"), TEXT("/me"), FString(), true, [this](bool bOk, const FString& Response, const FString& ErrorMessage)
    {
        if (!bOk)
        {
            OnProfileLoaded.Broadcast(false, FString(), 0.0f, FString(), ErrorMessage);
            OnRatingsLoaded.Broadcast(0.0f, 0.0f, ErrorMessage);
            return;
        }

        TSharedPtr<FJsonObject> Json;
        TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(Response);
        if (!FJsonSerializer::Deserialize(Reader, Json) || !Json.IsValid())
        {
            const FString ParseError = TEXT("Failed to parse /me response JSON.");
            OnProfileLoaded.Broadcast(false, FString(), 0.0f, FString(), ParseError);
            OnRatingsLoaded.Broadcast(0.0f, 0.0f, ParseError);
            return;
        }

        CachedNickname = Json->GetStringField(CityApiJsonKeys::Nickname);
        CachedGameRating = Json->GetNumberField(CityApiJsonKeys::GameRating);
        CachedMlmRating = Json->GetNumberField(CityApiJsonKeys::MlmRating);

        FString SubscriptionLabel = TEXT("No subscription");
        const TSharedPtr<FJsonObject>* SubscriptionObject = nullptr;
        if (Json->TryGetObjectField(CityApiJsonKeys::Subscription, SubscriptionObject) && SubscriptionObject && SubscriptionObject->IsValid())
        {
            (*SubscriptionObject)->TryGetStringField(CityApiJsonKeys::Tier, SubscriptionLabel);
        }
        CachedSubscription = SubscriptionLabel;

        OnRatingsLoaded.Broadcast(CachedGameRating, CachedMlmRating, FString());

        SendJsonRequest(TEXT("GET"), TEXT("/wallet"), FString(), true, [this](bool bWalletOk, const FString& WalletResponse, const FString& WalletError)
        {
            if (!bWalletOk)
            {
                OnProfileLoaded.Broadcast(false, CachedNickname, 0.0f, CachedSubscription, WalletError);
                return;
            }

            TSharedPtr<FJsonObject> WalletJson;
            TSharedRef<TJsonReader<>> WalletReader = TJsonReaderFactory<>::Create(WalletResponse);
            if (!FJsonSerializer::Deserialize(WalletReader, WalletJson) || !WalletJson.IsValid())
            {
                OnProfileLoaded.Broadcast(false, CachedNickname, 0.0f, CachedSubscription, TEXT("Failed to parse /wallet response JSON."));
                return;
            }

            const float Balance = static_cast<float>(WalletJson->GetNumberField(CityApiJsonKeys::BalanceToken));
            OnProfileLoaded.Broadcast(true, CachedNickname, Balance, CachedSubscription, FString());
        });
    });
}

void UCityApiSubsystem::Logout()
{
    AccessToken.Reset();
    SaveToken();
}

bool UCityApiSubsystem::HasAccessToken() const
{
    return !AccessToken.IsEmpty();
}

FString UCityApiSubsystem::GetAccessToken() const
{
    return AccessToken;
}

void UCityApiSubsystem::SaveToken()
{
    UCityAuthSaveGame* SaveGame = Cast<UCityAuthSaveGame>(UGameplayStatics::CreateSaveGameObject(UCityAuthSaveGame::StaticClass()));
    if (!SaveGame)
    {
        return;
    }

    SaveGame->AccessToken = AccessToken;
    UGameplayStatics::SaveGameToSlot(SaveGame, SaveSlotName, 0);
}

void UCityApiSubsystem::LoadToken()
{
    if (!UGameplayStatics::DoesSaveGameExist(SaveSlotName, 0))
    {
        return;
    }

    UCityAuthSaveGame* SaveGame = Cast<UCityAuthSaveGame>(UGameplayStatics::LoadGameFromSlot(SaveSlotName, 0));
    if (SaveGame)
    {
        AccessToken = SaveGame->AccessToken;
    }
}

FString UCityApiSubsystem::BuildUrl(const FString& Path) const
{
    const FString TrimmedBase = ApiBaseUrl.EndsWith(TEXT("/")) ? ApiBaseUrl.LeftChop(1) : ApiBaseUrl;
    const FString NormalizedPath = Path.StartsWith(TEXT("/")) ? Path : (TEXT("/") + Path);
    return TrimmedBase + NormalizedPath;
}

void UCityApiSubsystem::SendJsonRequest(const FString& Method, const FString& Path, const FString& Body, bool bAuthorized, TFunction<void(bool, const FString&, const FString&)> OnCompleted)
{
    TSharedRef<IHttpRequest, ESPMode::ThreadSafe> Request = FHttpModule::Get().CreateRequest();
    Request->SetURL(BuildUrl(Path));
    Request->SetVerb(Method);
    Request->SetHeader(TEXT("Content-Type"), TEXT("application/json"));

    if (bAuthorized && !AccessToken.IsEmpty())
    {
        Request->SetHeader(TEXT("Authorization"), FString::Printf(TEXT("Bearer %s"), *AccessToken));
    }

    if (!Body.IsEmpty())
    {
        Request->SetContentAsString(Body);
    }

    Request->OnProcessRequestComplete().BindLambda([OnCompleted](FHttpRequestPtr, FHttpResponsePtr Response, bool bConnectedSuccessfully)
    {
        if (!bConnectedSuccessfully || !Response.IsValid())
        {
            OnCompleted(false, FString(), TEXT("HTTP request failed: no response from server."));
            return;
        }

        const FString ResponseBody = Response->GetContentAsString();
        const bool bStatusOk = Response->GetResponseCode() >= 200 && Response->GetResponseCode() < 300;

        if (!bStatusOk)
        {
            FString ExtractedError;
            if (!ExtractErrorMessage(ResponseBody, ExtractedError))
            {
                ExtractedError = FString::Printf(TEXT("HTTP %d"), Response->GetResponseCode());
            }
            OnCompleted(false, ResponseBody, ExtractedError);
            return;
        }

        OnCompleted(true, ResponseBody, FString());
    });

    Request->ProcessRequest();
}

bool UCityApiSubsystem::ExtractErrorMessage(const FString& JsonString, FString& OutError)
{
    TSharedPtr<FJsonObject> Json;
    TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(JsonString);

    if (!FJsonSerializer::Deserialize(Reader, Json) || !Json.IsValid())
    {
        return false;
    }

    if (Json->TryGetStringField(CityApiJsonKeys::Message, OutError))
    {
        return true;
    }

    return Json->TryGetStringField(CityApiJsonKeys::Error, OutError);
}
